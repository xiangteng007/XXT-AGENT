/**
 * Market Intelligence Types
 * Per SPEC_PHASE6_5_PHASE7.md
 */

// ================================
// Watchlist
// ================================

export interface WatchlistItem {
    id: string;
    uid: string;
    enabled: boolean;
    symbol: string;
    assetClass: 'stock' | 'future' | 'fund' | 'fx' | 'crypto';
    thresholds: WatchlistThresholds;
    createdAt: Date;
    updatedAt: Date;
}

export interface WatchlistThresholds {
    spikePct1m: number;  // Default: 0.8%
    spikePct5m: number;  // Default: 1.5%
    volatilityAtr: number; // Default: 2.0
    volumeSpikeFactor: number; // Default: 2.0
}

// ================================
// Market Ticks
// ================================

export interface MarketTick {
    id: string; // {symbol}_{minuteTs}
    symbol: string;
    ts: Date;
    price: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    changePct1m: number;
    changePct5m: number;
    changePct1h: number;
    volumeSpike: boolean;
    avgVolume20: number;
}

// ================================
// Market News
// ================================

export interface MarketNews {
    id: string;
    ts: Date;
    title: string;
    source: string;
    url: string;
    relatedSymbols: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
    severity: number;
    keywords: string[];
    dedupHash: string;
}

// ================================
// Market Signals
// ================================

export interface MarketSignal {
    id: string;
    ts: Date;
    symbol: string;
    signalType: 'price_spike' | 'volume_spike' | 'volatility_high' | 'news_impact' | 'fusion';
    severity: number; // 0-100
    direction: 'positive' | 'negative' | 'mixed' | 'neutral';
    confidence: number; // 0-1
    rationale: string;
    suggestedZones?: {
        entryRange: [number, number];
        exitRange: [number, number];
    };
    riskControls: {
        stopLoss: number;
        maxPositionPct: number;
    };
    disclaimer: string;
}

// ================================
// Market Adapter Interface
// ================================

export interface MarketAdapter {
    name: string;
    fetchQuotes(symbols: string[], timeframe: '1m' | '5m' | '1h'): Promise<QuoteData[]>;
    fetchHistory(symbol: string, range: '1d' | '5d' | '1mo' | '3mo'): Promise<OHLCV[]>;
}

export interface QuoteData {
    symbol: string;
    price: number;
    open: number;
    high: number;
    low: number;
    prevClose: number;
    volume: number;
    ts: Date;
}

export interface OHLCV {
    ts: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// ================================
// News Adapter Interface
// ================================

export interface NewsAdapter {
    name: string;
    fetchBreakingNews(query: string, fromTs: Date, toTs: Date): Promise<RawNews[]>;
}

export interface RawNews {
    title: string;
    url: string;
    source: string;
    publishedAt: Date;
    summary?: string;
}

// ================================
// Anomaly Detection Config
// ================================

export interface AnomalyConfig {
    priceSpike5mThreshold: number; // Default: 1.5%
    volumeSpikeMultiplier: number; // Default: 2.0
    volatilityAtrThreshold: number; // Default: 2.0
}

export const DEFAULT_ANOMALY_CONFIG: AnomalyConfig = {
    priceSpike5mThreshold: 1.5,
    volumeSpikeMultiplier: 2.0,
    volatilityAtrThreshold: 2.0,
};

// ================================
// Signal Detection Result
// ================================

export interface SignalDetectionResult {
    hasSignal: boolean;
    signalType?: MarketSignal['signalType'];
    severity: number;
    direction: 'positive' | 'negative' | 'mixed' | 'neutral';
    confidence: number;
    rationale: string;
}
