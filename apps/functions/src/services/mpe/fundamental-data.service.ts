/**
 * Fundamental Data Service — 基本面資料攝入
 *
 * 資料來源：
 *   - FinMind Open API（免費，限速 600 req/day）
 *     https://finmind.github.io/
 *   - TWSE 官方 API（完全免費，台股法人籌碼）
 *
 * 涵蓋：
 *   台股：法人買賣超 / 融資融券 / 三大法人 / 外資持股%
 *   美股：EPS 修正方向 / 內部人交易（備援）
 */

import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import fetch from 'node-fetch';

const db = getFirestore();
const FINMIND_TOKEN = process.env.FINMIND_API_TOKEN ?? '';
const FINMIND_BASE  = 'https://api.finmindtrade.com/api/v4/data';
const TWSE_BASE     = 'https://www.twse.com.tw/rwd/zh';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface InstitutionalFlow {
  date: string;
  symbol: string;
  foreignBuyNet: number;      // 外資買超（張）
  investTrustBuyNet: number;  // 投信買超（張）
  dealerBuyNet: number;       // 自營商買超（張）
  totalInstitutionalNet: number;
}

export interface MarginBalance {
  date: string;
  symbol: string;
  marginBalance: number;      // 融資餘額（千股）
  marginBalanceChange: number;
  shortBalance: number;       // 融券餘額（千股）
  shortBalanceChange: number;
  shortRatio: number;         // 券資比 %
}

export interface FundamentalSnapshot {
  symbol: string;
  date: string;
  institutional: InstitutionalFlow | null;
  margin: MarginBalance | null;
  foreignOwnership: number;   // 外資持股比例 %
  pe: number;                 // 本益比
  pb: number;                 // 股價淨值比
  dividend: number;           // 殖利率 %
}

// ─────────────────────────────────────────
// TWSE 三大法人（免費，不需 token）
// ─────────────────────────────────────────

export async function fetchInstitutionalFlow(
  symbol: string,
  date?: string
): Promise<InstitutionalFlow | null> {
  const today = date ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');

  try {
    const url = `${TWSE_BASE}/fund/T86?date=${today}&selectType=ALLBUT&response=json`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 XXT-Agent/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`TWSE HTTP ${resp.status}`);
    const json = await resp.json() as {
      data?: string[][];
      fields?: string[];
      stat?: string;
    };

    if (json.stat !== 'OK' || !json.data) return null;

    // TWSE data format: [代號, 名稱, 外資買, 外資賣, 外資淨, 投信買, 投信賣, 投信淨, 自營買, 自營賣, 自營淨, 合計]
    const row = json.data.find(r => r[0] === symbol);
    if (!row) return null;

    const clean = (s: string) => parseInt(s.replace(/,/g, ''), 10) || 0;

    return {
      date: today,
      symbol,
      foreignBuyNet:       clean(row[4]),
      investTrustBuyNet:   clean(row[7]),
      dealerBuyNet:        clean(row[10]),
      totalInstitutionalNet: clean(row[11]),
    };
  } catch (err) {
    logger.warn(`[FundamentalData] TWSE institutional fetch failed for ${symbol}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─────────────────────────────────────────
// FinMind — 融資融券
// ─────────────────────────────────────────

export async function fetchMarginBalance(
  symbol: string,
  days = 5
): Promise<MarginBalance | null> {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  try {
    const params = new URLSearchParams({
      dataset: 'TaiwanStockMarginPurchaseShortSale',
      data_id: symbol,
      start_date: startDate,
      end_date: endDate,
      token: FINMIND_TOKEN,
    });

    const resp = await fetch(`${FINMIND_BASE}?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`FinMind HTTP ${resp.status}`);
    const json = await resp.json() as { data?: Array<Record<string, unknown>> };

    const rows = json.data ?? [];
    if (rows.length === 0) return null;

    // Take the latest row
    const r = rows[rows.length - 1] as Record<string, number | string>;
    const margin  = Number(r['MarginPurchaseBalance'] ?? 0);
    const prevM   = rows.length > 1 ? Number((rows[rows.length - 2] as Record<string, number>)['MarginPurchaseBalance'] ?? 0) : margin;
    const short   = Number(r['ShortSaleBalance'] ?? 0);
    const prevS   = rows.length > 1 ? Number((rows[rows.length - 2] as Record<string, number>)['ShortSaleBalance'] ?? 0) : short;

    return {
      date: String(r['date'] ?? endDate),
      symbol,
      marginBalance:       margin,
      marginBalanceChange: margin - prevM,
      shortBalance:        short,
      shortBalanceChange:  short - prevS,
      shortRatio:          margin > 0 ? (short / margin) * 100 : 0,
    };
  } catch (err) {
    logger.warn(`[FundamentalData] FinMind margin fetch failed for ${symbol}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─────────────────────────────────────────
// TWSE BWIBBU — 本益比/淨值比/殖利率（免費）
// + FinMind — 外資持股比例
// ─────────────────────────────────────────

interface ValuationResult {
  foreignOwnership: number;
  pe: number;
  pb: number;
  dividend: number;
}

async function fetchValuationMetrics(symbol: string): Promise<ValuationResult> {
  const result: ValuationResult = { foreignOwnership: 0, pe: 0, pb: 0, dividend: 0 };

  // 1. TWSE BWIBBU_d — PE / PB / Dividend Yield (完全免費)
  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const url = `${TWSE_BASE}/afterTrading/BWIBBU_d?date=${today}&stockNo=${symbol}&response=json`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 XXT-Agent/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (resp.ok) {
      const json = await resp.json() as {
        data?: string[][];
        stat?: string;
      };
      if (json.stat === 'OK' && json.data && json.data.length > 0) {
        // Latest row: [殖利率, 股利年度, 本益比, 股價淨值比, 財報年/季]
        const latest = json.data[json.data.length - 1];
        result.dividend = parseFloat(latest[0]) || 0;
        result.pe = parseFloat(latest[2]) || 0;
        result.pb = parseFloat(latest[3]) || 0;
      }
    }
  } catch (err) {
    logger.warn(`[FundamentalData] TWSE BWIBBU fetch failed for ${symbol}:`, err instanceof Error ? err.message : err);
  }

  // 2. FinMind — 外資持股比例（需 token，無 token 跳過）
  if (FINMIND_TOKEN) {
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const params = new URLSearchParams({
        dataset: 'TaiwanStockShareholding',
        data_id: symbol,
        start_date: startDate,
        end_date: endDate,
        token: FINMIND_TOKEN,
      });
      const resp = await fetch(`${FINMIND_BASE}?${params}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const json = await resp.json() as { data?: Array<Record<string, unknown>> };
        const rows = json.data ?? [];
        if (rows.length > 0) {
          const latest = rows[rows.length - 1];
          result.foreignOwnership = Number(latest['ForeignInvestmentSharesRatio'] ?? 0);
        }
      }
    } catch (err) {
      logger.warn(`[FundamentalData] FinMind shareholding fetch failed for ${symbol}:`, err instanceof Error ? err.message : err);
    }
  }

  return result;
}

// ─────────────────────────────────────────
// Full Fundamental Snapshot
// ─────────────────────────────────────────

export async function fetchFundamentalSnapshot(symbol: string): Promise<FundamentalSnapshot> {
  const cacheKey = `mpe_fundamental_${symbol}`;
  const cached = await getCachedFundamental(cacheKey);
  if (cached) return cached;

  const [institutional, margin, valuation] = await Promise.all([
    fetchInstitutionalFlow(symbol),
    fetchMarginBalance(symbol),
    fetchValuationMetrics(symbol),
  ]);

  const snapshot: FundamentalSnapshot = {
    symbol,
    date: new Date().toISOString().slice(0, 10),
    institutional,
    margin,
    foreignOwnership: valuation.foreignOwnership,
    pe: valuation.pe,
    pb: valuation.pb,
    dividend: valuation.dividend,
  };

  // Cache for 60 minutes
  await db.collection('mpe_fundamental_cache').doc(symbol).set({
    ...snapshot,
    cachedAt: Timestamp.now(),
  });

  return snapshot;
}

async function getCachedFundamental(key: string): Promise<FundamentalSnapshot | null> {
  try {
    const symbol = key.replace('mpe_fundamental_', '');
    const doc = await db.collection('mpe_fundamental_cache').doc(symbol).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    const cachedAt = (data.cachedAt as Timestamp).toMillis();
    if (Date.now() - cachedAt > 60 * 60 * 1000) return null;
    return data as FundamentalSnapshot;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// Prompt Formatter
// ─────────────────────────────────────────

export function formatFundamentalForPrompt(snap: FundamentalSnapshot): string {
  const lines: string[] = [`【基本面 ${snap.symbol} ${snap.date}】`];

  if (snap.institutional) {
    const inst = snap.institutional;
    const total = inst.totalInstitutionalNet;
    lines.push(
      `三大法人：外資 ${inst.foreignBuyNet > 0 ? '+' : ''}${inst.foreignBuyNet.toLocaleString()}張`,
      `         投信 ${inst.investTrustBuyNet > 0 ? '+' : ''}${inst.investTrustBuyNet.toLocaleString()}張`,
      `         合計淨買超 ${total > 0 ? '+' : ''}${total.toLocaleString()}張`,
    );
  } else {
    lines.push('三大法人：資料不可用');
  }

  if (snap.margin) {
    const m = snap.margin;
    lines.push(
      `融資餘額：${m.marginBalance.toLocaleString()}千股 (${m.marginBalanceChange > 0 ? '+' : ''}${m.marginBalanceChange.toLocaleString()})`,
      `券資比：${m.shortRatio.toFixed(2)}%`,
    );
  }

  // Valuation metrics
  const valParts: string[] = [];
  if (snap.pe > 0) valParts.push(`PE ${snap.pe.toFixed(1)}`);
  if (snap.pb > 0) valParts.push(`PB ${snap.pb.toFixed(2)}`);
  if (snap.dividend > 0) valParts.push(`殖利率 ${snap.dividend.toFixed(2)}%`);
  if (snap.foreignOwnership > 0) valParts.push(`外資持股 ${snap.foreignOwnership.toFixed(1)}%`);
  if (valParts.length > 0) {
    lines.push(`估值：${valParts.join(' / ')}`);
  }

  return lines.join('\n');
}
