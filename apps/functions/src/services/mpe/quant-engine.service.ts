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

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

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
  // Trend & randomness
  entropy: number;         // 0-1 (higher=more random)
  hurstExponent: number;   // 0-1 (>0.5=trending, <0.5=mean-reverting)
  autocorr1: number;       // lag-1 autocorrelation (-1 to 1)
  // Volatility
  realizedVol: number;     // 30-day annualized realized volatility %
  volatilityRegime: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  // Trend
  drift: number;           // % deviation from 20-period SMA
  driftDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  // Price levels
  poc: number;             // Point of Control (highest volume price)
  valueAreaHigh: number;
  valueAreaLow: number;
  supportLevels: number[];
  resistanceLevels: number[];
  // Composite signal
  quantSignal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  quantScore: number;      // -100 to +100
}

// ─────────────────────────────────────────
// Core Math Utilities
// ─────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

/** Shannon entropy of return distribution (bucketed into 10 bins) */
function shannonEntropy(returns: number[]): number {
  if (returns.length < 10) return 0.5;

  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const range = max - min;
  if (range === 0) return 0;

  const bins = 10;
  const counts = new Array(bins).fill(0);
  for (const r of returns) {
    const idx = Math.min(Math.floor(((r - min) / range) * bins), bins - 1);
    counts[idx]++;
  }

  let entropy = 0;
  const n = returns.length;
  for (const c of counts) {
    if (c > 0) {
      const p = c / n;
      entropy -= p * Math.log2(p);
    }
  }

  // Normalize to 0-1 (max entropy = log2(bins) ≈ 3.32)
  return entropy / Math.log2(bins);
}

/** Simplified Hurst Exponent via R/S analysis */
function hurstExponent(prices: number[]): number {
  if (prices.length < 20) return 0.5;

  const n = prices.length;
  const logReturns = [];
  for (let i = 1; i < n; i++) {
    logReturns.push(Math.log(prices[i] / prices[i - 1]));
  }

  const lags = [2, 4, 8, 16].filter(l => l < logReturns.length / 2);
  if (lags.length < 2) return 0.5;

  const rsValues: number[] = [];
  for (const lag of lags) {
    const rs: number[] = [];
    for (let start = 0; start + lag <= logReturns.length; start += lag) {
      const chunk = logReturns.slice(start, start + lag);
      const m = mean(chunk);
      const deviations = chunk.map((v, i) => chunk.slice(0, i + 1).reduce((a, b) => a + b - m, 0));
      const R = Math.max(...deviations) - Math.min(...deviations);
      const S = stddev(chunk);
      if (S > 0) rs.push(R / S);
    }
    if (rs.length > 0) rsValues.push(mean(rs));
  }

  // Linear regression of log(RS) vs log(lag)
  const logLags = lags.map(l => Math.log(l));
  const logRs = rsValues.map(r => Math.log(Math.max(r, 0.0001)));

  const n2 = Math.min(logLags.length, logRs.length);
  const mx = mean(logLags.slice(0, n2));
  const my = mean(logRs.slice(0, n2));
  let num = 0, den = 0;
  for (let i = 0; i < n2; i++) {
    num += (logLags[i] - mx) * (logRs[i] - my);
    den += (logLags[i] - mx) ** 2;
  }

  return den > 0 ? Math.max(0, Math.min(1, num / den)) : 0.5;
}

/** Lag-1 autocorrelation */
function autocorrelation(returns: number[], lag = 1): number {
  if (returns.length < lag + 2) return 0;
  const m = mean(returns);
  let num = 0, den = 0;
  for (let i = lag; i < returns.length; i++) {
    num += (returns[i] - m) * (returns[i - lag] - m);
    den += (returns[i] - m) ** 2;
  }
  return den > 0 ? Math.max(-1, Math.min(1, num / den)) : 0;
}

/** Annualized realized volatility */
function realizedVol(prices: number[], tradingDaysPerYear = 252): number {
  if (prices.length < 2) return 0;
  const logReturns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > 0 && prices[i - 1] > 0) {
      logReturns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return stddev(logReturns) * Math.sqrt(tradingDaysPerYear) * 100;
}

/** SMA drift */
function smaDeviation(prices: number[], period = 20): number {
  if (prices.length < period) return 0;
  const sma = mean(prices.slice(-period));
  const current = prices[prices.length - 1];
  return ((current - sma) / sma) * 100;
}

/** Simple k-means (k=3 clusters) for price support/resistance */
function kMeansClusters(prices: number[], k = 3): number[] {
  if (prices.length < k) return [...prices];

  // Initialize centroids evenly spaced
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  let centroids = Array.from({ length: k }, (_, i) => min + ((max - min) * i) / (k - 1));

  for (let iter = 0; iter < 10; iter++) {
    const clusters: number[][] = Array.from({ length: k }, () => []);
    for (const p of prices) {
      let closest = 0;
      let minDist = Math.abs(p - centroids[0]);
      for (let c = 1; c < k; c++) {
        const d = Math.abs(p - centroids[c]);
        if (d < minDist) { minDist = d; closest = c; }
      }
      clusters[closest].push(p);
    }
    centroids = clusters.map(c => c.length > 0 ? mean(c) : centroids[clusters.indexOf(c)]);
  }

  return centroids.sort((a, b) => a - b);
}

/** Volume-weighted Point of Control */
function calcPOC(candles: OHLCV[]): { poc: number; vah: number; val: number } {
  if (candles.length === 0) return { poc: 0, vah: 0, val: 0 };

  // Build price→volume map
  const priceMap: Map<number, number> = new Map();
  const step = 0.5; // Price bucket size

  for (const c of candles) {
    const low  = Math.round(c.low  / step) * step;
    const high = Math.round(c.high / step) * step;
    const volumePerPrice = c.volume / Math.max(1, (high - low) / step + 1);

    for (let price = low; price <= high; price = Math.round((price + step) * 100) / 100) {
      priceMap.set(price, (priceMap.get(price) ?? 0) + volumePerPrice);
    }
  }

  // Find POC
  let maxVol = 0;
  let poc = 0;
  priceMap.forEach((vol, price) => {
    if (vol > maxVol) { maxVol = vol; poc = price; }
  });

  // Value Area (70% of total volume)
  const totalVol = [...priceMap.values()].reduce((a, b) => a + b, 0);
  const targetVol = totalVol * 0.7;

  // Sort prices around POC and expand until 70% reached
  const sortedPrices = [...priceMap.keys()].sort((a, b) => a - b);
  let vah = poc, val = poc, accumulated = maxVol;

  let hi = sortedPrices.indexOf(poc) + 1;
  let lo = sortedPrices.indexOf(poc) - 1;

  while (accumulated < targetVol && (hi < sortedPrices.length || lo >= 0)) {
    const hiVol = hi < sortedPrices.length ? (priceMap.get(sortedPrices[hi]) ?? 0) : -1;
    const loVol = lo >= 0 ? (priceMap.get(sortedPrices[lo]) ?? 0) : -1;

    if (hiVol >= loVol && hiVol >= 0) {
      vah = sortedPrices[hi]; accumulated += hiVol; hi++;
    } else if (loVol >= 0) {
      val = sortedPrices[lo]; accumulated += loVol; lo--;
    } else break;
  }

  return { poc, vah, val };
}

// ─────────────────────────────────────────
// Main calculator
// ─────────────────────────────────────────

export function calculateQuantMetrics(symbol: string, candles: OHLCV[]): QuantMetrics {
  if (candles.length < 10) {
    return {
      symbol,
      timestamp: new Date(),
      entropy: 0.5, hurstExponent: 0.5, autocorr1: 0,
      realizedVol: 0, volatilityRegime: 'LOW',
      drift: 0, driftDirection: 'NEUTRAL',
      poc: 0, valueAreaHigh: 0, valueAreaLow: 0,
      supportLevels: [], resistanceLevels: [],
      quantSignal: 'NEUTRAL', quantScore: 0,
    };
  }

  const prices  = candles.map(c => c.close);
  const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);

  const entropy    = shannonEntropy(returns);
  const hurst      = hurstExponent(prices);
  const autocorr1  = autocorrelation(returns);
  const vol        = realizedVol(prices);
  const drift      = smaDeviation(prices);
  const { poc, vah, val } = calcPOC(candles);

  // Volatility regime
  let volatilityRegime: QuantMetrics['volatilityRegime'] = 'LOW';
  if (vol > 60) volatilityRegime = 'EXTREME';
  else if (vol > 35) volatilityRegime = 'HIGH';
  else if (vol > 20) volatilityRegime = 'MEDIUM';

  // Drift direction
  let driftDirection: QuantMetrics['driftDirection'] = 'NEUTRAL';
  if (drift > 2)  driftDirection = 'BULLISH';
  if (drift < -2) driftDirection = 'BEARISH';

  // K-means clusters → support/resistance
  const recentPrices = prices.slice(-50);
  const clusters = kMeansClusters(recentPrices, 5);
  const currentPrice = prices[prices.length - 1];
  const supportLevels    = clusters.filter(c => c < currentPrice).slice(-2);
  const resistanceLevels = clusters.filter(c => c > currentPrice).slice(0, 2);

  // Composite score
  let score = 0;

  // Hurst: trend-following bias
  if (hurst > 0.6 && drift > 0) score += 20;
  else if (hurst > 0.6 && drift < 0) score -= 20;

  // Low entropy = more predictable = higher confidence
  if (entropy < 0.4) score += 10;
  else if (entropy > 0.7) score -= 10;

  // Autocorrelation
  if (autocorr1 > 0.2) score += 15;
  else if (autocorr1 < -0.2) score -= 15;

  // Drift
  score += Math.max(-30, Math.min(30, drift * 3));

  // Volatility penalty
  if (volatilityRegime === 'EXTREME') score = Math.sign(score) * Math.min(Math.abs(score), 20);
  if (volatilityRegime === 'HIGH') score *= 0.7;

  const quantScore = Math.round(Math.max(-100, Math.min(100, score)));

  let quantSignal: QuantMetrics['quantSignal'] = 'NEUTRAL';
  if (quantScore >= 50) quantSignal = 'STRONG_BUY';
  else if (quantScore >= 20) quantSignal = 'BUY';
  else if (quantScore <= -50) quantSignal = 'STRONG_SELL';
  else if (quantScore <= -20) quantSignal = 'SELL';

  return {
    symbol,
    timestamp: new Date(),
    entropy,
    hurstExponent: Math.round(hurst * 1000) / 1000,
    autocorr1: Math.round(autocorr1 * 1000) / 1000,
    realizedVol: Math.round(vol * 10) / 10,
    volatilityRegime,
    drift: Math.round(drift * 100) / 100,
    driftDirection,
    poc,
    valueAreaHigh: vah,
    valueAreaLow:  val,
    supportLevels,
    resistanceLevels,
    quantSignal,
    quantScore,
  };
}

// ─────────────────────────────────────────
// Prompt Formatter
// ─────────────────────────────────────────

export function formatQuantForPrompt(m: QuantMetrics): string {
  return [
    `【量化指標 ${m.symbol}】`,
    `Hurst ${m.hurstExponent.toFixed(3)} (${m.hurstExponent > 0.5 ? '趨勢市' : '震盪市'}) | 熵值 ${m.entropy.toFixed(2)} (${m.entropy < 0.5 ? '可預測' : '高隨機'})`,
    `波動率：${m.realizedVol.toFixed(1)}% 年化 | 狀態：${m.volatilityRegime}`,
    `均線偏差：${m.drift > 0 ? '+' : ''}${m.drift.toFixed(2)}% (${m.driftDirection})`,
    `POC：${m.poc.toFixed(2)} | Value Area：${m.valueAreaLow.toFixed(2)}～${m.valueAreaHigh.toFixed(2)}`,
    `支撐：${m.supportLevels.map(p => p.toFixed(2)).join(', ')} | 壓力：${m.resistanceLevels.map(p => p.toFixed(2)).join(', ')}`,
    `Quant 訊號：${m.quantSignal}（${m.quantScore > 0 ? '+' : ''}${m.quantScore}分）`,
  ].join('\n');
}
