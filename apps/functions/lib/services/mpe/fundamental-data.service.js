"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchInstitutionalFlow = fetchInstitutionalFlow;
exports.fetchMarginBalance = fetchMarginBalance;
exports.fetchFundamentalSnapshot = fetchFundamentalSnapshot;
exports.formatFundamentalForPrompt = formatFundamentalForPrompt;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const node_fetch_1 = __importDefault(require("node-fetch"));
const db = (0, firestore_1.getFirestore)();
const FINMIND_TOKEN = process.env.FINMIND_API_TOKEN ?? '';
const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';
const TWSE_BASE = 'https://www.twse.com.tw/rwd/zh';
// ─────────────────────────────────────────
// TWSE 三大法人（免費，不需 token）
// ─────────────────────────────────────────
async function fetchInstitutionalFlow(symbol, date) {
    const today = date ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');
    try {
        const url = `${TWSE_BASE}/fund/T86?date=${today}&selectType=ALLBUT&response=json`;
        const resp = await (0, node_fetch_1.default)(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 XXT-Agent/1.0' },
            signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok)
            throw new Error(`TWSE HTTP ${resp.status}`);
        const json = await resp.json();
        if (json.stat !== 'OK' || !json.data)
            return null;
        // TWSE data format: [代號, 名稱, 外資買, 外資賣, 外資淨, 投信買, 投信賣, 投信淨, 自營買, 自營賣, 自營淨, 合計]
        const row = json.data.find(r => r[0] === symbol);
        if (!row)
            return null;
        const clean = (s) => parseInt(s.replace(/,/g, ''), 10) || 0;
        return {
            date: today,
            symbol,
            foreignBuyNet: clean(row[4]),
            investTrustBuyNet: clean(row[7]),
            dealerBuyNet: clean(row[10]),
            totalInstitutionalNet: clean(row[11]),
        };
    }
    catch (err) {
        v2_1.logger.warn(`[FundamentalData] TWSE institutional fetch failed for ${symbol}:`, err instanceof Error ? err.message : err);
        return null;
    }
}
// ─────────────────────────────────────────
// FinMind — 融資融券
// ─────────────────────────────────────────
async function fetchMarginBalance(symbol, days = 5) {
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
        const resp = await (0, node_fetch_1.default)(`${FINMIND_BASE}?${params}`, {
            signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok)
            throw new Error(`FinMind HTTP ${resp.status}`);
        const json = await resp.json();
        const rows = json.data ?? [];
        if (rows.length === 0)
            return null;
        // Take the latest row
        const r = rows[rows.length - 1];
        const margin = Number(r['MarginPurchaseBalance'] ?? 0);
        const prevM = rows.length > 1 ? Number(rows[rows.length - 2]['MarginPurchaseBalance'] ?? 0) : margin;
        const short = Number(r['ShortSaleBalance'] ?? 0);
        const prevS = rows.length > 1 ? Number(rows[rows.length - 2]['ShortSaleBalance'] ?? 0) : short;
        return {
            date: String(r['date'] ?? endDate),
            symbol,
            marginBalance: margin,
            marginBalanceChange: margin - prevM,
            shortBalance: short,
            shortBalanceChange: short - prevS,
            shortRatio: margin > 0 ? (short / margin) * 100 : 0,
        };
    }
    catch (err) {
        v2_1.logger.warn(`[FundamentalData] FinMind margin fetch failed for ${symbol}:`, err instanceof Error ? err.message : err);
        return null;
    }
}
// ─────────────────────────────────────────
// Full Fundamental Snapshot
// ─────────────────────────────────────────
async function fetchFundamentalSnapshot(symbol) {
    const cacheKey = `mpe_fundamental_${symbol}`;
    const cached = await getCachedFundamental(cacheKey);
    if (cached)
        return cached;
    const [institutional, margin] = await Promise.all([
        fetchInstitutionalFlow(symbol),
        fetchMarginBalance(symbol),
    ]);
    const snapshot = {
        symbol,
        date: new Date().toISOString().slice(0, 10),
        institutional,
        margin,
        foreignOwnership: 0, // TODO: TWSE FINI API
        pe: 0, // TODO: FinMind PriceEarningRatio
        pb: 0,
        dividend: 0,
    };
    // Cache for 60 minutes
    await db.collection('mpe_fundamental_cache').doc(symbol).set({
        ...snapshot,
        cachedAt: firestore_1.Timestamp.now(),
    });
    return snapshot;
}
async function getCachedFundamental(key) {
    try {
        const symbol = key.replace('mpe_fundamental_', '');
        const doc = await db.collection('mpe_fundamental_cache').doc(symbol).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        const cachedAt = data.cachedAt.toMillis();
        if (Date.now() - cachedAt > 60 * 60 * 1000)
            return null;
        return data;
    }
    catch {
        return null;
    }
}
// ─────────────────────────────────────────
// Prompt Formatter
// ─────────────────────────────────────────
function formatFundamentalForPrompt(snap) {
    const lines = [`【基本面 ${snap.symbol} ${snap.date}】`];
    if (snap.institutional) {
        const inst = snap.institutional;
        const total = inst.totalInstitutionalNet;
        lines.push(`三大法人：外資 ${inst.foreignBuyNet > 0 ? '+' : ''}${inst.foreignBuyNet.toLocaleString()}張`, `         投信 ${inst.investTrustBuyNet > 0 ? '+' : ''}${inst.investTrustBuyNet.toLocaleString()}張`, `         合計淨買超 ${total > 0 ? '+' : ''}${total.toLocaleString()}張`);
    }
    else {
        lines.push('三大法人：資料不可用');
    }
    if (snap.margin) {
        const m = snap.margin;
        lines.push(`融資餘額：${m.marginBalance.toLocaleString()}千股 (${m.marginBalanceChange > 0 ? '+' : ''}${m.marginBalanceChange.toLocaleString()})`, `券資比：${m.shortRatio.toFixed(2)}%`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=fundamental-data.service.js.map