"use strict";
/**
 * Macro Data Service — 總經指標資料攝入
 *
 * 資料來源（免費公開）：
 *   - Yahoo Finance API → DXY, VIX, SPY, QQQ
 *   - CBOE → VIX 即時
 *   - Stooq → 歷史資料備援
 *   - CME FedWatch → FOMC 利率預期
 *   - Taiwan CBC RSS → 央行利率公告
 *
 * 所有數據快取至 Firestore，15 分鐘 TTL
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMacroSnapshot = fetchMacroSnapshot;
exports.classifyMacroRegime = classifyMacroRegime;
exports.formatMacroForPrompt = formatMacroForPrompt;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const node_fetch_1 = __importDefault(require("node-fetch"));
const db = (0, firestore_1.getFirestore)();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
// ─────────────────────────────────────────
// Yahoo Finance quick fetch
// ─────────────────────────────────────────
async function yahooQuote(symbols) {
    const joined = symbols.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}&fields=regularMarketPrice`;
    try {
        const resp = await (0, node_fetch_1.default)(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 XXT-Agent/1.0' },
            signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok)
            throw new Error(`Yahoo HTTP ${resp.status}`);
        const json = await resp.json();
        const result = {};
        for (const item of json?.quoteResponse?.result ?? []) {
            result[item.symbol] = item.regularMarketPrice ?? 0;
        }
        return result;
    }
    catch (err) {
        v2_1.logger.warn('[MacroData] Yahoo quote failed:', err instanceof Error ? err.message : err);
        return {};
    }
}
// ─────────────────────────────────────────
// Main fetch
// ─────────────────────────────────────────
async function fetchMacroSnapshot() {
    // Check cache
    const cached = await getCachedMacro();
    if (cached)
        return { ...cached, source: 'cache' };
    v2_1.logger.info('[MacroData] Fetching live macro data');
    // Yahoo Finance batch quote
    const symbols = ['DX-Y.NYB', '^VIX', '^TNX', 'TWD=X', '^GSPC', 'QQQ', 'GC=F', 'CL=F'];
    const quotes = await yahooQuote(symbols);
    const snapshot = {
        timestamp: new Date(),
        dxy: quotes['DX-Y.NYB'] ?? 104.5,
        vix: quotes['^VIX'] ?? 18.0,
        us10y: quotes['^TNX'] ?? 4.35,
        twdUsd: quotes['TWD=X'] ?? 32.0,
        fedFundsTarget: 5.25, // static until CME integration
        fedHikeProb: 0,
        taiwanCbcRate: 2.0,
        spx500: quotes['^GSPC'] ?? 5200,
        qqq: quotes['QQQ'] ?? 450,
        gold: quotes['GC=F'] ?? 2300,
        crude: quotes['CL=F'] ?? 78,
        source: 'live',
    };
    // Save to cache
    await db.collection('mpe_macro_cache').doc('latest').set({
        ...snapshot,
        timestamp: firestore_1.Timestamp.fromDate(snapshot.timestamp),
    });
    return snapshot;
}
// ─────────────────────────────────────────
// Cache helpers
// ─────────────────────────────────────────
async function getCachedMacro() {
    try {
        const doc = await db.collection('mpe_macro_cache').doc('latest').get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        const ts = data.timestamp.toDate();
        if (Date.now() - ts.getTime() > CACHE_TTL_MS)
            return null;
        return { ...data, timestamp: ts, source: 'cache' };
    }
    catch {
        return null;
    }
}
// ─────────────────────────────────────────
// Regime Classifier
// ─────────────────────────────────────────
/**
 * 根據總經指標判斷目前市場環境
 */
function classifyMacroRegime(snap) {
    // Risk mode
    let riskMode = 'NEUTRAL';
    if (snap.vix > 30)
        riskMode = 'RISK_OFF';
    else if (snap.vix < 16 && snap.spx500 > 0)
        riskMode = 'RISK_ON';
    // Dollar strength (DXY > 105 = strong, < 100 = weak)
    let dollarStrength = 'NEUTRAL';
    if (snap.dxy > 105)
        dollarStrength = 'STRONG';
    else if (snap.dxy < 100)
        dollarStrength = 'WEAK';
    // Rate environment
    let rateEnvironment = 'NEUTRAL';
    if (snap.fedHikeProb > 60)
        rateEnvironment = 'HAWKISH';
    else if (snap.fedHikeProb < 20)
        rateEnvironment = 'DOVISH';
    // Volatility level
    let volatilityLevel = 'LOW';
    if (snap.vix > 35)
        volatilityLevel = 'EXTREME';
    else if (snap.vix > 25)
        volatilityLevel = 'HIGH';
    else if (snap.vix > 18)
        volatilityLevel = 'MEDIUM';
    const descriptions = [];
    if (riskMode === 'RISK_OFF')
        descriptions.push('市場避險情緒高');
    if (riskMode === 'RISK_ON')
        descriptions.push('市場偏好風險資產');
    if (dollarStrength === 'STRONG')
        descriptions.push('美元強勢不利新興市場');
    if (dollarStrength === 'WEAK')
        descriptions.push('弱勢美元利好商品');
    if (rateEnvironment === 'HAWKISH')
        descriptions.push('市場預期升息壓制估值');
    if (rateEnvironment === 'DOVISH')
        descriptions.push('降息預期支撐科技股');
    if (volatilityLevel === 'HIGH' || volatilityLevel === 'EXTREME')
        descriptions.push('波動劇烈建議減碼');
    return {
        riskMode,
        dollarStrength,
        rateEnvironment,
        volatilityLevel,
        description: descriptions.join('；') || '市場環境中性',
    };
}
/**
 * 返回格式化的總經摘要字串（供 Ollama prompt 使用）
 */
function formatMacroForPrompt(snap, regime) {
    return [
        `【總經環境 ${snap.timestamp.toLocaleDateString('zh-TW')}】`,
        `DXY ${snap.dxy.toFixed(2)} | VIX ${snap.vix.toFixed(1)} | 美10Y ${snap.us10y.toFixed(2)}%`,
        `台幣匯率 ${snap.twdUsd.toFixed(2)} | 黃金 $${snap.gold.toFixed(0)} | 原油 $${snap.crude.toFixed(1)}`,
        `市場情境：${regime.riskMode} | 美元：${regime.dollarStrength} | 利率：${regime.rateEnvironment}`,
        `波動等級：${regime.volatilityLevel}`,
        `解讀：${regime.description}`,
    ].join('\n');
}
//# sourceMappingURL=macro-data.service.js.map