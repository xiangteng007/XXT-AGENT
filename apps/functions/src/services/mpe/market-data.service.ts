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

import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import fetch from 'node-fetch';

const db = getFirestore();

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface OHLCVBar {
  timestamp: number;  // Unix seconds
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface OHLCVData {
  symbol:      string;     // normalized (e.g. "2330", "TSLA")
  yahooSymbol: string;     // Yahoo ticker (e.g. "2330.TW", "TSLA")
  currency:    string;
  bars:        OHLCVBar[];
  latestClose: number;
  fetchedAt:   Date;
  source:      'live' | 'cache';
}

// ─────────────────────────────────────────
// Symbol normalizer
// ─────────────────────────────────────────

function toYahooSymbol(symbol: string): string {
  // Taiwan stock: 4-6 digit number → append .TW
  if (/^\d{4,6}$/.test(symbol)) return `${symbol}.TW`;
  // ETF like 0050, 006208 already handled above
  return symbol.toUpperCase();
}

function isTaiwanStock(symbol: string): boolean {
  return /^\d{4,6}$/.test(symbol);
}

// ─────────────────────────────────────────
// Yahoo Finance Chart API
// ─────────────────────────────────────────

async function fetchYahooOHLCV(
  yahooSymbol: string,
  range = '3mo',
  interval = '1d',
): Promise<OHLCVBar[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}` +
    `?range=${range}&interval=${interval}&includePrePost=false`;

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 XXT-Agent/1.0' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) throw new Error(`Yahoo HTTP ${resp.status} for ${yahooSymbol}`);

  const json = await resp.json() as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open:   (number | null)[];
            high:   (number | null)[];
            low:    (number | null)[];
            close:  (number | null)[];
            volume: (number | null)[];
          }>;
        };
      }>;
      error?: { message: string };
    };
  };

  const result = json?.chart?.result?.[0];
  if (!result) {
    const errMsg = json?.chart?.error?.message ?? 'No result';
    throw new Error(`Yahoo chart error: ${errMsg}`);
  }

  const timestamps = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0];
  if (!q || timestamps.length === 0) throw new Error('Empty OHLCV data');

  const bars: OHLCVBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = q.close[i];
    if (close === null || close === undefined) continue;
    bars.push({
      timestamp: timestamps[i],
      open:   q.open[i]   ?? close,
      high:   q.high[i]   ?? close,
      low:    q.low[i]    ?? close,
      close,
      volume: q.volume[i] ?? 0,
    });
  }

  return bars;
}

// ─────────────────────────────────────────
// Cache helpers
// ─────────────────────────────────────────

async function getCachedOHLCV(symbol: string): Promise<OHLCVData | null> {
  try {
    const doc = await db.collection('mpe_ohlcv_cache').doc(symbol).get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    const fetchedAt = (data.fetchedAt as Timestamp).toDate();
    const ttlMs = isTaiwanStock(symbol) ? 60 * 60 * 1000 : 30 * 60 * 1000;

    if (Date.now() - fetchedAt.getTime() > ttlMs) return null;

    return { ...data, fetchedAt, source: 'cache' } as OHLCVData;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────

/**
 * Fetch 3-month daily OHLCV bars for a symbol.
 * Returns cache-first, falls back to Yahoo Finance.
 */
export async function fetchOHLCV(
  symbol: string,
  range = '3mo',
): Promise<OHLCVData> {
  const cached = await getCachedOHLCV(symbol);
  if (cached) return cached;

  const yahooSymbol = toYahooSymbol(symbol);
  logger.info(`[MarketData] Fetching OHLCV: ${yahooSymbol} range=${range}`);

  const bars = await fetchYahooOHLCV(yahooSymbol, range);

  if (bars.length === 0) throw new Error(`No OHLCV bars for ${symbol}`);

  const latestClose = bars[bars.length - 1].close;

  // Persist to cache
  const ohlcvData: OHLCVData = {
    symbol,
    yahooSymbol,
    currency: isTaiwanStock(symbol) ? 'TWD' : 'USD',
    bars,
    latestClose,
    fetchedAt: new Date(),
    source: 'live',
  };

  await db.collection('mpe_ohlcv_cache').doc(symbol).set({
    ...ohlcvData,
    fetchedAt: Timestamp.fromDate(ohlcvData.fetchedAt),
  });

  return ohlcvData;
}

/**
 * Extract closing prices array from OHLCV data (for quant-engine).
 */
export function extractClosePrices(data: OHLCVData): number[] {
  return data.bars.map(b => b.close);
}

/**
 * Calculate realized annualized volatility from close prices.
 * Uses log returns, annualized assuming 252 trading days.
 */
export function calcAnnualizedVolatility(closePrices: number[]): number {
  if (closePrices.length < 5) return 25; // fallback

  const returns: number[] = [];
  for (let i = 1; i < closePrices.length; i++) {
    returns.push(Math.log(closePrices[i] / closePrices[i - 1]));
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
  const dailyStd = Math.sqrt(variance);

  return Math.round(dailyStd * Math.sqrt(252) * 100 * 100) / 100; // percentage
}

/**
 * Calculate annualized drift (mean log return × 252).
 */
export function calcAnnualizedDrift(closePrices: number[]): number {
  if (closePrices.length < 5) return 0;

  const returns: number[] = [];
  for (let i = 1; i < closePrices.length; i++) {
    returns.push(Math.log(closePrices[i] / closePrices[i - 1]));
  }

  const meanDailyReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  return Math.round(meanDailyReturn * 252 * 100 * 100) / 100; // percentage
}
