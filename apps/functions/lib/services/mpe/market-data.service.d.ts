/**
 * Market Data Service — K線資料攝入
 *
 * 資料來源（免費公開）：
 *   - Yahoo Finance v8 Chart API（OHLCV，台股/美股）
 *
 * 快取策略：Firestore TTL
 *   - 台股日K：60 分鐘 TTL（盤中更新慢）
 *   - 美股日K：30 分鐘 TTL
 *
 * 台股代號自動附加 .TW 後綴。
 */
export interface OHLCVBar {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export interface OHLCVData {
    symbol: string;
    yahooSymbol: string;
    currency: string;
    bars: OHLCVBar[];
    latestClose: number;
    fetchedAt: Date;
    source: 'live' | 'cache';
}
/**
 * Fetch 3-month daily OHLCV bars for a symbol.
 * Returns cache-first, falls back to Yahoo Finance.
 */
export declare function fetchOHLCV(symbol: string, range?: string): Promise<OHLCVData>;
/**
 * Extract closing prices array from OHLCV data (for quant-engine).
 */
export declare function extractClosePrices(data: OHLCVData): number[];
/**
 * Calculate realized annualized volatility from close prices.
 * Uses log returns, annualized assuming 252 trading days.
 */
export declare function calcAnnualizedVolatility(closePrices: number[]): number;
/**
 * Calculate annualized drift (mean log return × 252).
 */
export declare function calcAnnualizedDrift(closePrices: number[]): number;
//# sourceMappingURL=market-data.service.d.ts.map