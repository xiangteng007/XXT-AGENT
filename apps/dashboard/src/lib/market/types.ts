// Comprehensive market monitoring types

// ============ Core Types ============

export type AssetType =
    | 'stock'
    | 'etf'
    | 'crypto'
    | 'future'
    | 'forex'
    | 'bond'
    | 'commodity';

export type MarketStatus = 'pre_market' | 'open' | 'after_hours' | 'closed';

export type TrendDirection = 'up' | 'down' | 'flat';

// ============ Quote Data ============

export interface Quote {
    symbol: string;
    name: string;
    type: AssetType;
    exchange: string;
    currency: string;

    // Price data
    lastPrice: number;
    previousClose: number;
    open: number;
    high: number;
    low: number;

    // Change
    change: number;
    changePct: number;

    // Volume
    volume: number;
    avgVolume: number;
    volumeRatio: number;

    // 52-week
    high52w: number;
    low52w: number;

    // Timestamps
    lastTradeTime: string;
    marketStatus: MarketStatus;

    // Extended data
    bid?: number;
    ask?: number;
    bidSize?: number;
    askSize?: number;
    marketCap?: number;
    pe?: number;
    eps?: number;
    dividendYield?: number;
}

// ============ Watchlist ============

export interface WatchlistItem {
    id: string;
    symbol: string;
    name: string;
    type: AssetType;

    // User settings
    alertPrice?: number;
    notes?: string;
    tags: string[];
    group: string;
    sortOrder: number;

    // Current data
    quote?: Quote;

    addedAt: string;
}

export interface WatchlistGroup {
    id: string;
    name: string;
    color: string;
    sortOrder: number;
    itemCount: number;
}

// ============ Signals & Alerts ============

export type SignalType =
    | 'price_breakout'
    | 'volume_spike'
    | 'pattern'
    | 'indicator'
    | 'news'
    | 'earnings'
    | 'custom';

export type SignalStrength = 'strong' | 'medium' | 'weak';

export interface MarketSignal {
    id: string;
    symbol: string;
    type: SignalType;
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: SignalStrength;

    // Details
    title: string;
    description: string;

    // Technical
    price: number;
    target?: number;
    stopLoss?: number;

    // Timing
    detectedAt: string;
    validUntil?: string;

    // Tracking
    isRead: boolean;
    isDismissed: boolean;
}

// ============ Heatmap ============

export interface HeatmapCell {
    symbol: string;
    name: string;
    sector: string;
    industry: string;

    // Size
    marketCap: number;
    weight: number;

    // Performance
    changePct: number;
    volume: number;

    // For rendering
    color: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

export interface Sector {
    id: string;
    name: string;
    changePct: number;
    marketCap: number;
    volume: number;
    stocks: HeatmapCell[];
}

// ============ Technical Analysis ============

export interface TechnicalIndicators {
    symbol: string;
    timestamp: string;

    // Moving averages
    sma20: number;
    sma50: number;
    sma200: number;
    ema12: number;
    ema26: number;

    // Momentum
    rsi14: number;
    macd: { macd: number; signal: number; histogram: number };
    stochastic: { k: number; d: number };

    // Volatility
    bollingerBands: { upper: number; middle: number; lower: number };
    atr14: number;

    // Volume
    vwap: number;
    obv: number;

    // Trend
    adx: number;
    trend: TrendDirection;
    support: number[];
    resistance: number[];
}

// ============ Dashboard Summary ============

export interface MarketDashboardSummary {
    // Market overview
    marketStatus: MarketStatus;
    lastUpdate: string;

    // Indices
    indices: {
        name: string;
        value: number;
        change: number;
        changePct: number;
    }[];

    // Your portfolio
    watchlistCount: number;
    alertsCount: number;
    signalsToday: number;

    // Top movers
    gainers: Quote[];
    losers: Quote[];
    mostActive: Quote[];

    // Sectors
    sectorPerformance: {
        sector: string;
        changePct: number;
    }[];
}

// ============ Analytics ============

export interface MarketAnalytics {
    period: { start: string; end: string };

    // Breadth
    advanceDecline: { advances: number; declines: number; unchanged: number };
    newHighsLows: { highs: number; lows: number };

    // Volatility
    vix?: number;

    // Correlation
    sectorCorrelation?: Record<string, Record<string, number>>;
}
