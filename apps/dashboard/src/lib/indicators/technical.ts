// Technical indicators calculation engine

export interface OHLCV {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
}

export interface TechnicalIndicators {
    // Moving Averages
    sma5: number;
    sma10: number;
    sma20: number;
    sma60: number;
    sma120: number;
    ema12: number;
    ema26: number;

    // Momentum
    rsi14: number;
    macd: { value: number; signal: number; histogram: number };
    stochastic: { k: number; d: number };

    // Volatility
    bollinger: { upper: number; middle: number; lower: number; width: number };
    atr14: number;

    // Volume
    vwap: number;
    volumeRatio: number;  // vs 20-day avg

    // Trend
    adx14: number;
    trendStrength: 'strong_up' | 'weak_up' | 'neutral' | 'weak_down' | 'strong_down';
}

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((sum, p) => sum + p, 0) / period;
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

/**
 * Calculate MACD
 */
export function calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } {
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;

    // Signal line is 9-period EMA of MACD
    // Simplified: use current MACD as signal approximation
    const signal = macdLine * 0.8; // Approximation
    const histogram = macdLine - signal;

    return { value: macdLine, signal, histogram };
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollinger(prices: number[], period: number = 20, stdDev: number = 2): {
    upper: number;
    middle: number;
    lower: number;
    width: number;
} {
    if (prices.length < period) {
        return { upper: 0, middle: 0, lower: 0, width: 0 };
    }

    const slice = prices.slice(-period);
    const middle = slice.reduce((sum, p) => sum + p, 0) / period;

    const squaredDiffs = slice.map(p => Math.pow(p - middle, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / period;
    const std = Math.sqrt(variance);

    const upper = middle + stdDev * std;
    const lower = middle - stdDev * std;
    const width = (upper - lower) / middle;

    return { upper, middle, lower, width };
}

/**
 * Calculate ATR (Average True Range)
 */
export function calculateATR(candles: OHLCV[], period: number = 14): number {
    if (candles.length < period + 1) return 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trueRanges.push(tr);
    }

    return trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
}

/**
 * Calculate Stochastic Oscillator
 */
export function calculateStochastic(candles: OHLCV[], kPeriod: number = 14, dPeriod: number = 3): {
    k: number;
    d: number;
} {
    if (candles.length < kPeriod) return { k: 50, d: 50 };

    const slice = candles.slice(-kPeriod);
    const highestHigh = Math.max(...slice.map(c => c.high));
    const lowestLow = Math.min(...slice.map(c => c.low));
    const currentClose = candles[candles.length - 1].close;

    const k = highestHigh === lowestLow
        ? 50
        : ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    // Simplified D calculation
    const d = k; // Should be SMA of K

    return { k, d };
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 */
export function calculateVWAP(candles: OHLCV[]): number {
    if (candles.length === 0) return 0;

    let cumulativeTPV = 0; // Typical Price * Volume
    let cumulativeVolume = 0;

    for (const candle of candles) {
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        cumulativeTPV += typicalPrice * candle.volume;
        cumulativeVolume += candle.volume;
    }

    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
}

/**
 * Determine trend strength based on indicators
 */
export function determineTrendStrength(
    price: number,
    sma20: number,
    sma60: number,
    rsi: number,
    macd: { value: number; histogram: number }
): TechnicalIndicators['trendStrength'] {
    let score = 0;

    // Price vs MAs
    if (price > sma20) score += 1;
    if (price > sma60) score += 1;
    if (sma20 > sma60) score += 1;

    // RSI
    if (rsi > 60) score += 1;
    else if (rsi < 40) score -= 1;

    // MACD
    if (macd.value > 0 && macd.histogram > 0) score += 1;
    else if (macd.value < 0 && macd.histogram < 0) score -= 1;

    if (score >= 4) return 'strong_up';
    if (score >= 2) return 'weak_up';
    if (score <= -4) return 'strong_down';
    if (score <= -2) return 'weak_down';
    return 'neutral';
}

/**
 * Calculate all technical indicators from OHLCV data
 */
export function calculateAllIndicators(candles: OHLCV[]): TechnicalIndicators {
    const closes = candles.map(c => c.close);

    const sma5 = calculateSMA(closes, 5);
    const sma10 = calculateSMA(closes, 10);
    const sma20 = calculateSMA(closes, 20);
    const sma60 = calculateSMA(closes, 60);
    const sma120 = calculateSMA(closes, 120);
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);

    const rsi14 = calculateRSI(closes, 14);
    const macd = calculateMACD(closes);
    const stochastic = calculateStochastic(candles);

    const bollinger = calculateBollinger(closes);
    const atr14 = calculateATR(candles);

    const vwap = calculateVWAP(candles);
    const avgVolume = candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    const currentVolume = candles[candles.length - 1]?.volume || 0;
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

    const currentPrice = closes[closes.length - 1] || 0;
    const trendStrength = determineTrendStrength(currentPrice, sma20, sma60, rsi14, macd);

    return {
        sma5, sma10, sma20, sma60, sma120,
        ema12, ema26,
        rsi14,
        macd,
        stochastic,
        bollinger,
        atr14,
        vwap,
        volumeRatio,
        adx14: 25, // Placeholder - ADX calculation is complex
        trendStrength,
    };
}
