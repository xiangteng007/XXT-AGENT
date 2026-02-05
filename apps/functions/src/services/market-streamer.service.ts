/**
 * Market Streamer Service
 * 
 * Fetches market quotes, detects anomalies, and generates signals/fused events.
 * Triggered by Cloud Scheduler every minute.
 */

import * as admin from 'firebase-admin';
import {
    WatchlistItem,
    MarketTick,
    MarketSignal,
    QuoteData,
    AnomalyConfig,
    DEFAULT_ANOMALY_CONFIG,
    SignalDetectionResult,
} from '../types/market.types';
import { FusedEvent } from '../types/social.types';
import { incrementMetric } from './metrics.service';
import { getErrorMessage } from '../utils/error-handling';

const db = admin.firestore();

/**
 * Main streamer function - run every minute
 */
export async function runMarketStreamer(): Promise<{
    processed: number;
    signals: number;
    errors: string[];
}> {
    console.log('[Market Streamer] Starting cycle...');

    const result = { processed: 0, signals: 0, errors: [] as string[] };

    try {
        // Get all enabled watchlist items
        const watchlistItems = await getEnabledWatchlistItems();
        console.log(`[Market Streamer] Found ${watchlistItems.length} watchlist items`);

        if (watchlistItems.length === 0) {
            return result;
        }

        // Group by symbol to avoid duplicate fetches
        const symbols = [...new Set(watchlistItems.map(w => w.symbol))];

        // Fetch quotes for all symbols
        const quotes = await fetchQuotes(symbols);
        result.processed = quotes.length;

        // Process each quote
        for (const quote of quotes) {
            try {
                // Store tick
                await storeTick(quote);

                // Get historical data for context
                const history = await getRecentTicks(quote.symbol, 60); // Last 60 minutes

                // Detect anomalies
                const detection = detectAnomalies(quote, history, DEFAULT_ANOMALY_CONFIG);

                if (detection.hasSignal) {
                    // Create signal
                    await createSignal(quote, detection);

                    // Create fused event
                    await createMarketFusedEvent(quote, detection);

                    result.signals++;
                }
            } catch (err: unknown) {
                console.error(`[Market Streamer] Error processing ${quote.symbol}:`, err);
                result.errors.push(`${quote.symbol}: ${getErrorMessage(err)}`);
            }
        }

        // Log metrics
        await incrementMetric('system', 'market_quotes_processed', result.processed);
        await incrementMetric('system', 'market_signals_generated', result.signals);

        console.log('[Market Streamer] Cycle complete:', result);
        return result;

    } catch (err: unknown) {
        console.error('[Market Streamer] Fatal error:', err);
        result.errors.push(getErrorMessage(err));
        return result;
    }
}

/**
 * Get all enabled watchlist items across all users
 */
async function getEnabledWatchlistItems(): Promise<WatchlistItem[]> {
    const items: WatchlistItem[] = [];

    const usersSnapshot = await db.collection('watchlists').listDocuments();

    for (const userDoc of usersSnapshot) {
        const itemsSnapshot = await userDoc.collection('items')
            .where('enabled', '==', true)
            .get();

        itemsSnapshot.docs.forEach(doc => {
            items.push({
                id: doc.id,
                uid: userDoc.id,
                ...doc.data(),
            } as WatchlistItem);
        });
    }

    return items;
}

/**
 * Fetch quotes from market data provider
 */
async function fetchQuotes(symbols: string[]): Promise<QuoteData[]> {
    // TODO: Implement actual market data provider adapter
    // For now, return mock data
    console.log(`[Market Streamer] Fetching quotes for ${symbols.length} symbols`);

    return symbols.map(symbol => ({
        symbol,
        price: 100 + Math.random() * 10,
        open: 99,
        high: 105,
        low: 98,
        prevClose: 100,
        volume: Math.floor(1000000 + Math.random() * 500000),
        ts: new Date(),
    }));
}

/**
 * Store tick data
 */
async function storeTick(quote: QuoteData): Promise<void> {
    const minuteTs = Math.floor(quote.ts.getTime() / 60000) * 60000;
    const tickId = `${quote.symbol}_${minuteTs}`;

    // Get previous ticks for change calculation
    const history = await getRecentTicks(quote.symbol, 60);

    const tick5mAgo = history.find(t => t.ts.getTime() <= quote.ts.getTime() - 5 * 60000);
    const tick1hAgo = history.find(t => t.ts.getTime() <= quote.ts.getTime() - 60 * 60000);

    const changePct1m = history.length > 0
        ? ((quote.price - history[0].price) / history[0].price) * 100
        : 0;
    const changePct5m = tick5mAgo
        ? ((quote.price - tick5mAgo.price) / tick5mAgo.price) * 100
        : 0;
    const changePct1h = tick1hAgo
        ? ((quote.price - tick1hAgo.price) / tick1hAgo.price) * 100
        : 0;

    // Calculate average volume
    const avgVolume20 = history.length > 0
        ? history.slice(0, 20).reduce((sum, t) => sum + t.volume, 0) / Math.min(history.length, 20)
        : quote.volume;

    const volumeSpike = quote.volume > avgVolume20 * 2;

    const tick: Omit<MarketTick, 'id'> = {
        symbol: quote.symbol,
        ts: quote.ts,
        price: quote.price,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.price,
        volume: quote.volume,
        changePct1m,
        changePct5m,
        changePct1h,
        volumeSpike,
        avgVolume20,
    };

    await db.collection('market_ticks').doc(tickId).set(tick);
}

/**
 * Get recent ticks for a symbol
 */
async function getRecentTicks(symbol: string, minutes: number): Promise<MarketTick[]> {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    const snapshot = await db.collection('market_ticks')
        .where('symbol', '==', symbol)
        .where('ts', '>=', since)
        .orderBy('ts', 'desc')
        .limit(minutes)
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        ts: doc.data().ts?.toDate?.() || new Date(),
    })) as MarketTick[];
}

/**
 * Detect anomalies in quote data
 */
function detectAnomalies(
    quote: QuoteData,
    history: MarketTick[],
    config: AnomalyConfig
): SignalDetectionResult {
    if (history.length < 5) {
        return { hasSignal: false, severity: 0, direction: 'neutral', confidence: 0, rationale: '' };
    }

    const latestTick = history[0];
    const signals: { type: MarketSignal['signalType']; severity: number; rationale: string }[] = [];

    // Price spike detection (5m)
    if (Math.abs(latestTick.changePct5m) >= config.priceSpike5mThreshold) {
        const severity = Math.min(100, Math.abs(latestTick.changePct5m) * 20);
        signals.push({
            type: 'price_spike',
            severity,
            rationale: `Price moved ${latestTick.changePct5m.toFixed(2)}% in 5 minutes`,
        });
    }

    // Volume spike detection
    if (latestTick.volumeSpike) {
        const volumeMultiple = latestTick.volume / latestTick.avgVolume20;
        const severity = Math.min(100, volumeMultiple * 25);
        signals.push({
            type: 'volume_spike',
            severity,
            rationale: `Volume is ${volumeMultiple.toFixed(1)}x average`,
        });
    }

    // Volatility detection (simplified ATR)
    const recentHighs = history.slice(0, 5).map(t => t.high);
    const recentLows = history.slice(0, 5).map(t => t.low);
    const avgRange = (Math.max(...recentHighs) - Math.min(...recentLows)) / quote.price * 100;

    if (avgRange >= config.volatilityAtrThreshold) {
        signals.push({
            type: 'volatility_high',
            severity: Math.min(100, avgRange * 20),
            rationale: `High volatility: ${avgRange.toFixed(2)}% range`,
        });
    }

    if (signals.length === 0) {
        return { hasSignal: false, severity: 0, direction: 'neutral', confidence: 0, rationale: '' };
    }

    // Return highest severity signal
    const topSignal = signals.sort((a, b) => b.severity - a.severity)[0];
    const direction = latestTick.changePct5m > 0 ? 'positive' : latestTick.changePct5m < 0 ? 'negative' : 'neutral';

    return {
        hasSignal: true,
        signalType: topSignal.type,
        severity: Math.round(topSignal.severity),
        direction,
        confidence: Math.min(0.95, 0.5 + (signals.length * 0.15)),
        rationale: signals.map(s => s.rationale).join('; '),
    };
}

/**
 * Create market signal
 */
async function createSignal(quote: QuoteData, detection: SignalDetectionResult): Promise<void> {
    const signal: Omit<MarketSignal, 'id'> = {
        ts: new Date(),
        symbol: quote.symbol,
        signalType: detection.signalType || 'price_spike',
        severity: detection.severity,
        direction: detection.direction,
        confidence: detection.confidence,
        rationale: detection.rationale,
        riskControls: {
            stopLoss: quote.price * 0.95, // 5% stop loss
            maxPositionPct: 20,
        },
        disclaimer: '僅供參考，非投資建議。投資有風險，請謹慎評估。',
    };

    await db.collection('market_signals').add(signal);
    console.log(`[Market Streamer] Created signal: ${signal.signalType} for ${quote.symbol}`);
}

/**
 * Create fused event from market signal
 */
async function createMarketFusedEvent(quote: QuoteData, detection: SignalDetectionResult): Promise<void> {
    const eventType = detection.signalType === 'price_spike' ? 'market.price.spike'
        : detection.signalType === 'volume_spike' ? 'market.volume.spike'
            : 'market.volatility.high';

    const event: Omit<FusedEvent, 'id'> = {
        ts: new Date(),
        tenantId: 'system',
        domain: 'market',
        eventType,
        title: `${quote.symbol} ${detection.signalType?.replace('_', ' ')}`,
        severity: detection.severity,
        direction: detection.direction,
        sentiment: detection.direction === 'positive' ? 'positive'
            : detection.direction === 'negative' ? 'negative'
                : 'neutral',
        keywords: [quote.symbol, detection.signalType || ''],
        entities: [{ type: 'ticker', value: quote.symbol }],
        market: {
            symbol: quote.symbol,
            assetClass: 'stock',
            price: quote.price,
            volumeSpike: detection.signalType === 'volume_spike',
        },
        rationale: detection.rationale,
    };

    await db.collection('fused_events').add({
        ...event,
        ts: admin.firestore.FieldValue.serverTimestamp(),
    });
}
