/**
 * Quant Engine Service — 量化指標計算
 *
 * 純 Node.js 運算，不依賴外部服務
 *
 * 計算：
 *   1. Shannon Entropy     — 市場隨機性（高=難預測）
 *   2. Hurst Exponent      — 趨勢強度（>0.5=趨勢，<0.5=均值回歸）
 *   3. Volatility Regime   — HMM 簡化版（低/中/高波動狀態）
 *   4. Price Drift         — 偏離移動均線的方向性偏差
 *   5. Autocorrelation     — 價格序列自相關（r(1)）
 *   6. K-means Clusters    — 支撐壓力價位聚類
 *   7. Volume-weighted POC — 最高成交量價位（Point of Control）
 */
export interface OHLCV {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
}
export interface QuantMetrics {
    symbol: string;
    timestamp: Date;
    entropy: number;
    hurstExponent: number;
    autocorr1: number;
    realizedVol: number;
    volatilityRegime: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    drift: number;
    driftDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    poc: number;
    valueAreaHigh: number;
    valueAreaLow: number;
    supportLevels: number[];
    resistanceLevels: number[];
    quantSignal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    quantScore: number;
}
export declare function calculateQuantMetrics(symbol: string, candles: OHLCV[]): QuantMetrics;
export declare function formatQuantForPrompt(m: QuantMetrics): string;
//# sourceMappingURL=quant-engine.service.d.ts.map