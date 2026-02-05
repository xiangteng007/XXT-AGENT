/**
 * Market Intelligence Types
 * Per SPEC_PHASE6_5_PHASE7.md
 */
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
    spikePct1m: number;
    spikePct5m: number;
    volatilityAtr: number;
    volumeSpikeFactor: number;
}
export interface MarketTick {
    id: string;
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
export interface MarketSignal {
    id: string;
    ts: Date;
    symbol: string;
    signalType: 'price_spike' | 'volume_spike' | 'volatility_high' | 'news_impact' | 'fusion';
    severity: number;
    direction: 'positive' | 'negative' | 'mixed' | 'neutral';
    confidence: number;
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
export interface AnomalyConfig {
    priceSpike5mThreshold: number;
    volumeSpikeMultiplier: number;
    volatilityAtrThreshold: number;
}
export declare const DEFAULT_ANOMALY_CONFIG: AnomalyConfig;
export interface SignalDetectionResult {
    hasSignal: boolean;
    signalType?: MarketSignal['signalType'];
    severity: number;
    direction: 'positive' | 'negative' | 'mixed' | 'neutral';
    confidence: number;
    rationale: string;
}
//# sourceMappingURL=market.types.d.ts.map