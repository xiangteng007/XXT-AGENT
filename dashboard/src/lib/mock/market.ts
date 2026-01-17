// Mock data for market system
import type { NotificationChannels } from './news';

export interface MarketAlertRule {
    id: string;
    name: string;
    symbol: string;
    type: 'price_above' | 'price_below' | 'pct_change' | 'volume_spike' | 'rsi_overbought' | 'rsi_oversold';
    value: number;
    enabled: boolean;
    channels: NotificationChannels;
    triggerCount: number;
}

export interface TechnicalIndicators {
    symbol: string;
    sma20: number;
    sma50: number;
    sma200: number;
    ema12: number;
    ema26: number;
    rsi14: number;
    macd: { value: number; signal: number; histogram: number };
    bollingerBands: { upper: number; middle: number; lower: number };
    atr14: number;
    vwap: number;
    obv: number;
    adx: number;
    support: number[];
    resistance: number[];
}

export const mockMarketAlerts: MarketAlertRule[] = [
    { id: '1', name: 'NVDA 突破 950', symbol: 'NVDA', type: 'price_above', value: 950, enabled: true, channels: { telegram: true, line: true, email: false }, triggerCount: 0 },
    { id: '2', name: 'AAPL 跌破 180', symbol: 'AAPL', type: 'price_below', value: 180, enabled: true, channels: { telegram: true, line: false, email: true }, triggerCount: 2 },
    { id: '3', name: 'TSLA 單日漲 5%', symbol: 'TSLA', type: 'pct_change', value: 5, enabled: true, channels: { telegram: true, line: false, email: false }, triggerCount: 5 },
    { id: '4', name: 'BTC 成交量異常', symbol: 'BTC-USD', type: 'volume_spike', value: 200, enabled: false, channels: { telegram: true, line: true, email: false }, triggerCount: 12 },
];

export const mockQuotes = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 185.92, change: 2.45, changePct: 1.34, volume: 52340000, high: 186.50, low: 183.20, open: 184.00 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 924.50, change: 28.30, changePct: 3.16, volume: 38920000, high: 932.00, low: 895.00, open: 898.00 },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.75, change: -5.25, changePct: -2.07, volume: 89120000, high: 255.00, low: 246.50, open: 253.00 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', price: 425.30, change: 4.80, changePct: 1.14, volume: 22450000, high: 427.00, low: 420.50, open: 421.00 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 178.45, change: 1.20, changePct: 0.68, volume: 18760000, high: 179.80, low: 176.90, open: 177.50 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 192.80, change: 3.40, changePct: 1.79, volume: 31240000, high: 194.20, low: 189.50, open: 190.00 },
    { symbol: 'META', name: 'Meta Platforms', price: 582.15, change: 12.60, changePct: 2.21, volume: 15680000, high: 585.00, low: 568.00, open: 570.00 },
    { symbol: 'BTC-USD', name: 'Bitcoin USD', price: 98450.00, change: 2150.00, changePct: 2.23, volume: 42500000000, high: 99200.00, low: 95800.00, open: 96300.00 },
];

export const mockIndicators: Record<string, TechnicalIndicators> = {
    'NVDA': {
        symbol: 'NVDA', sma20: 912.50, sma50: 875.30, sma200: 720.80,
        ema12: 918.40, ema26: 895.60, rsi14: 68.5,
        macd: { value: 22.8, signal: 18.5, histogram: 4.3 },
        bollingerBands: { upper: 955.20, middle: 912.50, lower: 869.80 },
        atr14: 28.50, vwap: 920.15, obv: 125000000, adx: 42.5,
        support: [900, 875, 850], resistance: [950, 980, 1000],
    },
    'AAPL': {
        symbol: 'AAPL', sma20: 183.20, sma50: 178.50, sma200: 175.30,
        ema12: 184.80, ema26: 182.10, rsi14: 55.2,
        macd: { value: 1.35, signal: 0.95, histogram: 0.40 },
        bollingerBands: { upper: 192.50, middle: 183.20, lower: 173.90 },
        atr14: 4.20, vwap: 185.40, obv: 89000000, adx: 28.3,
        support: [180, 175, 170], resistance: [190, 195, 200],
    },
};

export const mockHeatmapData = {
    sectors: [
        {
            name: '科技', change: 2.15, stocks: [
                { symbol: 'AAPL', name: 'Apple', changePct: 1.34 },
                { symbol: 'NVDA', name: 'NVIDIA', changePct: 3.16 },
                { symbol: 'MSFT', name: 'Microsoft', changePct: 1.14 },
            ]
        },
        {
            name: '金融', change: -0.85, stocks: [
                { symbol: 'JPM', name: 'JPMorgan', changePct: -1.20 },
                { symbol: 'BAC', name: 'Bank of America', changePct: -0.50 },
            ]
        },
    ],
};
