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

    // Advanced technical analysis
    patterns: string[];
    supports: number[];
    resistances: number[];
    fibonacci: { level: number; price: number }[];
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
 * Calculate MACD (Moving Average Convergence Divergence)
 * 
 * MACD Line  = EMA(12) - EMA(26)
 * Signal     = 9-period EMA of the MACD Line series
 * Histogram  = MACD Line - Signal Line
 */
export function calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } {
    if (prices.length < 26) return { value: 0, signal: 0, histogram: 0 };

    // Build the full MACD line series by computing EMA12 - EMA26 at each point
    const k12 = 2 / (12 + 1);
    const k26 = 2 / (26 + 1);

    let ema12 = prices[0];
    let ema26 = prices[0];
    const macdSeries: number[] = [];

    for (let i = 1; i < prices.length; i++) {
        ema12 = prices[i] * k12 + ema12 * (1 - k12);
        ema26 = prices[i] * k26 + ema26 * (1 - k26);
        // Only start recording MACD once we have enough data for EMA26
        if (i >= 25) {
            macdSeries.push(ema12 - ema26);
        }
    }

    const currentMACD = macdSeries[macdSeries.length - 1] || 0;

    // Signal line: 9-period EMA of the MACD series
    let signal = 0;
    if (macdSeries.length >= 9) {
        const kSignal = 2 / (9 + 1);
        signal = macdSeries[0];
        for (let i = 1; i < macdSeries.length; i++) {
            signal = macdSeries[i] * kSignal + signal * (1 - kSignal);
        }
    } else {
        signal = currentMACD;
    }

    const histogram = currentMACD - signal;

    return { value: currentMACD, signal, histogram };
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
 * Calculate Stochastic Oscillator (%K and %D)
 * 
 * %K = ((Close - Lowest Low) / (Highest High - Lowest Low)) × 100
 * %D = 3-period SMA of %K values ("slow stochastic")
 */
export function calculateStochastic(candles: OHLCV[], kPeriod: number = 14, dPeriod: number = 3): {
    k: number;
    d: number;
} {
    if (candles.length < kPeriod) return { k: 50, d: 50 };

    // Compute %K for the last dPeriod bars to build the %D (SMA of %K)
    const kValues: number[] = [];
    const barsNeeded = Math.min(candles.length - kPeriod + 1, dPeriod);

    for (let offset = barsNeeded - 1; offset >= 0; offset--) {
        const endIdx = candles.length - offset;
        const startIdx = endIdx - kPeriod;
        const window = candles.slice(startIdx, endIdx);
        const highestHigh = Math.max(...window.map(c => c.high));
        const lowestLow = Math.min(...window.map(c => c.low));
        const closePrice = candles[endIdx - 1].close;

        const kVal = highestHigh === lowestLow
            ? 50
            : ((closePrice - lowestLow) / (highestHigh - lowestLow)) * 100;
        kValues.push(kVal);
    }

    const k = kValues[kValues.length - 1];
    // %D = Simple Moving Average of the %K values
    const d = kValues.reduce((sum, v) => sum + v, 0) / kValues.length;

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
 * Detect Candlestick Patterns
 */
export function detectCandlestickPatterns(candles: OHLCV[]): string[] {
    if (candles.length < 3) return [];
    const patterns: string[] = [];
    const current = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const prev2 = candles[candles.length - 3];
    
    const bodySize = Math.abs(current.close - current.open);
    const upperShadow = current.high - Math.max(current.open, current.close);
    const lowerShadow = Math.min(current.open, current.close) - current.low;
    const totalSize = current.high - current.low || 1;

    // Doji
    if (bodySize <= totalSize * 0.1) patterns.push('Doji');
    
    // Hammer / Hanging Man (small body, long lower shadow, small/no upper shadow)
    if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5) patterns.push('Hammer');

    // Shooting Star (small body, long upper shadow, small/no lower shadow)
    if (upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5) patterns.push('Shooting Star');
    
    // Engulfing
    const isBullishEngulfing = current.close > current.open && prev.close < prev.open && current.close > prev.open && current.open < prev.close;
    const isBearishEngulfing = current.close < current.open && prev.close > prev.open && current.close < prev.open && current.open > prev.close;
    
    if (isBullishEngulfing) patterns.push('Bullish Engulfing');
    if (isBearishEngulfing) patterns.push('Bearish Engulfing');

    // Morning Star
    // Prev2: Bearish, Prev: Small body (star), Current: Bullish
    const prev2IsBearish = prev2.close < prev2.open;
    const prevIsSmall = Math.abs(prev.close - prev.open) <= (prev.high - prev.low) * 0.3;
    const currentIsBullish = current.close > current.open;
    if (prev2IsBearish && prevIsSmall && currentIsBullish && current.close > (prev2.open + prev2.close) / 2) {
        patterns.push('Morning Star');
    }

    // Evening Star
    // Prev2: Bullish, Prev: Small body (star), Current: Bearish
    const prev2IsBullish = prev2.close > prev2.open;
    const currentIsBearish = current.close < current.open;
    if (prev2IsBullish && prevIsSmall && currentIsBearish && current.close < (prev2.open + prev2.close) / 2) {
        patterns.push('Evening Star');
    }

    return patterns;
}

/**
 * Calculate Support and Resistance (Basic local extrema detection)
 */
export function calculateSupportResistance(candles: OHLCV[], lookback: number = 20): { supports: number[], resistances: number[] } {
    if (candles.length < lookback * 2) return { supports: [], resistances: [] };
    
    const supports: number[] = [];
    const resistances: number[] = [];
    
    // Simple logic: find local minimums and maximums over the given window
    for (let i = lookback; i < candles.length - lookback; i++) {
        let isSupport = true;
        let isResistance = true;
        const currentLow = candles[i].low;
        const currentHigh = candles[i].high;
        
        for (let j = i - lookback; j <= i + lookback; j++) {
            if (i === j) continue;
            if (candles[j].low < currentLow) isSupport = false;
            if (candles[j].high > currentHigh) isResistance = false;
        }
        
        if (isSupport) supports.push(currentLow);
        if (isResistance) resistances.push(currentHigh);
    }
    
    // Keep only the last 3 levels for cleaner output
    return {
        supports: Array.from(new Set(supports)).sort((a,b) => b-a).slice(-3),
        resistances: Array.from(new Set(resistances)).sort((a,b) => a-b).slice(-3)
    };
}

/**
 * Calculate Fibonacci Retracement Levels based on recent High/Low
 */
export function calculateFibonacciRetracement(candles: OHLCV[], lookback: number = 50): { level: number, price: number }[] {
    if (candles.length < lookback) return [];
    
    const slice = candles.slice(-lookback);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const diff = high - low;
    
    // Assume current trend is up (low to high) for generic levels
    // In a real scenario, this would depend on the detected trend direction.
    return [
        { level: 0, price: high },
        { level: 0.236, price: high - diff * 0.236 },
        { level: 0.382, price: high - diff * 0.382 },
        { level: 0.5, price: high - diff * 0.5 },
        { level: 0.618, price: high - diff * 0.618 },
        { level: 0.786, price: high - diff * 0.786 },
        { level: 1, price: low },
    ];
}

/**
 * Calculate ADX (Average Directional Index)
 */
export function calculateADX(candles: OHLCV[], period: number = 14): number {
    if (candles.length < period * 2) return 25;

    let trs: number[] = [];
    let pdms: number[] = [];
    let ndms: number[] = [];

    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevHigh = candles[i - 1].high;
        const prevLow = candles[i - 1].low;
        const prevClose = candles[i - 1].close;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );

        let pdm = high - prevHigh;
        let ndm = prevLow - low;

        if (pdm < 0) pdm = 0;
        if (ndm < 0) ndm = 0;
        if (pdm > ndm) ndm = 0;
        else if (ndm > pdm) pdm = 0;
        else { pdm = 0; ndm = 0; }

        trs.push(tr);
        pdms.push(pdm);
        ndms.push(ndm);
    }

    // Initial smoothed values
    let smoothedTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothedPDM = pdms.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothedNDM = ndms.slice(0, period).reduce((a, b) => a + b, 0);

    let dxs: number[] = [];

    for (let i = period; i < trs.length; i++) {
        const pdi = smoothedTR === 0 ? 0 : (smoothedPDM / smoothedTR) * 100;
        const ndi = smoothedTR === 0 ? 0 : (smoothedNDM / smoothedTR) * 100;
        const dx = (pdi + ndi) === 0 ? 0 : (Math.abs(pdi - ndi) / (pdi + ndi)) * 100;
        dxs.push(dx);

        if (i < trs.length - 1) {
            smoothedTR = smoothedTR - (smoothedTR / period) + trs[i + 1];
            smoothedPDM = smoothedPDM - (smoothedPDM / period) + pdms[i + 1];
            smoothedNDM = smoothedNDM - (smoothedNDM / period) + ndms[i + 1];
        }
    }

    if (dxs.length < period) return 25;

    let adx = dxs.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < dxs.length; i++) {
        adx = ((adx * (period - 1)) + dxs[i]) / period;
    }

    return adx;
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

    const patterns = detectCandlestickPatterns(candles);
    const { supports, resistances } = calculateSupportResistance(candles);
    const fibonacci = calculateFibonacciRetracement(candles);

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
        adx14: calculateADX(candles, 14),
        trendStrength,
        patterns,
        supports,
        resistances,
        fibonacci,
    };
}
