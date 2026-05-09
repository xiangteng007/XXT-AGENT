"use strict";
/**
 * Monte Carlo Simulation Service — 蒙特卡洛價格預測
 *
 * 模型：Geometric Brownian Motion (GBM)
 *
 * dS = μS·dt + σS·dW
 *
 * 輸入：
 *   - 當前價格 S0
 *   - 日收益率均值 μ（年化後的 drift）
 *   - 日波動率 σ（realizedVol / sqrt(252)）
 *   - 模擬次數 N = 10,000
 *   - 預測期間 T = 5個交易日
 *
 * 輸出：
 *   - 95% / 80% / 50% 信賴區間
 *   - 上漲/下跌機率
 *   - 各百分位價格
 *   - 預期最大回撤
 *
 * 全程純 Node.js 運算，無需任何外部服務。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMonteCarlo = runMonteCarlo;
exports.formatMonteCarloForPrompt = formatMonteCarloForPrompt;
// ─────────────────────────────────────────
// Box-Muller transform for N(0,1) samples
// ─────────────────────────────────────────
function randomNormal() {
    const u1 = Math.random() || 1e-10;
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
// ─────────────────────────────────────────
// Core GBM simulator
// ─────────────────────────────────────────
function simulatePath(S0, mu, // daily drift
sigma, // daily vol
T) {
    const path = [S0];
    let S = S0;
    for (let t = 0; t < T; t++) {
        const dW = randomNormal();
        S = S * Math.exp((mu - 0.5 * sigma * sigma) + sigma * dW);
        path.push(S);
    }
    return path;
}
// ─────────────────────────────────────────
// Percentile helper
// ─────────────────────────────────────────
function percentile(sorted, p) {
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi)
        return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
// ─────────────────────────────────────────
// Max drawdown of a single path
// ─────────────────────────────────────────
function maxDrawdown(path) {
    let peak = path[0];
    let maxDD = 0;
    for (const p of path) {
        if (p > peak)
            peak = p;
        const dd = (peak - p) / peak;
        if (dd > maxDD)
            maxDD = dd;
    }
    return maxDD;
}
// ─────────────────────────────────────────
// Main Monte Carlo function
// ─────────────────────────────────────────
function runMonteCarlo(input) {
    const { symbol, currentPrice, annualizedVolatility, annualizedDrift, horizonDays, simulations = 10_000, } = input;
    // Convert annual to daily
    const dailySigma = (annualizedVolatility / 100) / Math.sqrt(252);
    const dailyMu = (annualizedDrift / 100) / 252;
    // Run simulations
    const finalPrices = new Array(simulations);
    const drawdowns = new Array(simulations);
    for (let i = 0; i < simulations; i++) {
        const path = simulatePath(currentPrice, dailyMu, dailySigma, horizonDays);
        finalPrices[i] = path[path.length - 1];
        drawdowns[i] = maxDrawdown(path);
    }
    // Sort for percentiles
    finalPrices.sort((a, b) => a - b);
    drawdowns.sort((a, b) => a - b);
    const expectedPrice = finalPrices.reduce((a, b) => a + b, 0) / simulations;
    const medianPrice = percentile(finalPrices, 50);
    const p5 = percentile(finalPrices, 5);
    const p10 = percentile(finalPrices, 10);
    const p25 = percentile(finalPrices, 25);
    const p75 = percentile(finalPrices, 75);
    const p90 = percentile(finalPrices, 90);
    const p95 = percentile(finalPrices, 95);
    // Up probability
    const upCount = finalPrices.filter(p => p > currentPrice).length;
    const upProbability = Math.round((upCount / simulations) * 100);
    // Expected max drawdown (median of drawdown distribution)
    const expectedMaxDrawdown = Math.round(percentile(drawdowns, 50) * 1000) / 10; // %
    // VaR(95%) = loss at 5th percentile
    const var95 = Math.round((currentPrice - p5) * 100) / 100;
    // Target probability function
    const allFinalPrices = [...finalPrices]; // closure
    const targetProb = (target) => {
        const count = allFinalPrices.filter(p => p >= target).length;
        return Math.round((count / simulations) * 100);
    };
    const fmt = (n) => n.toFixed(2);
    const summary = [
        `${symbol} 蒙特卡洛 ${horizonDays}日預測（N=${simulations.toLocaleString()}）`,
        `當前：$${fmt(currentPrice)} | 預期：$${fmt(expectedPrice)} (${upProbability}% 上漲機率)`,
        `80% 信賴區間：$${fmt(p10)} ～ $${fmt(p90)}`,
        `95% 信賴區間：$${fmt(p5)} ～ $${fmt(p95)}`,
        `預期最大回撤：${expectedMaxDrawdown}% | VaR(95%)：$${fmt(var95)}`,
    ].join('\n');
    return {
        symbol,
        currentPrice,
        horizonDays,
        simulations,
        timestamp: new Date(),
        expectedPrice: Math.round(expectedPrice * 100) / 100,
        medianPrice: Math.round(medianPrice * 100) / 100,
        p5: Math.round(p5 * 100) / 100,
        p10: Math.round(p10 * 100) / 100,
        p25: Math.round(p25 * 100) / 100,
        p75: Math.round(p75 * 100) / 100,
        p90: Math.round(p90 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        upProbability,
        targetProb,
        expectedMaxDrawdown,
        var95,
        ci80: [Math.round(p10 * 100) / 100, Math.round(p90 * 100) / 100],
        ci95: [Math.round(p5 * 100) / 100, Math.round(p95 * 100) / 100],
        summary,
    };
}
// ─────────────────────────────────────────
// Prompt Formatter
// ─────────────────────────────────────────
function formatMonteCarloForPrompt(r) {
    return [
        `【蒙特卡洛模擬 ${r.symbol} ${r.horizonDays}日】`,
        `上漲機率：${r.upProbability}% | 預期目標：$${r.expectedPrice.toFixed(2)}`,
        `80% 落點：$${r.p10.toFixed(2)} ～ $${r.p90.toFixed(2)}`,
        `95% 落點：$${r.p5.toFixed(2)} ～ $${r.p95.toFixed(2)}`,
        `預期最大回撤：${r.expectedMaxDrawdown}% | VaR(95%)：$${r.var95.toFixed(2)}`,
    ].join('\n');
}
//# sourceMappingURL=monte-carlo.service.js.map