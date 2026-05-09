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
export interface MonteCarloInput {
    symbol: string;
    currentPrice: number;
    annualizedVolatility: number;
    annualizedDrift: number;
    horizonDays: number;
    simulations?: number;
}
export interface MonteCarloResult {
    symbol: string;
    currentPrice: number;
    horizonDays: number;
    simulations: number;
    timestamp: Date;
    expectedPrice: number;
    medianPrice: number;
    p5: number;
    p10: number;
    p25: number;
    p75: number;
    p90: number;
    p95: number;
    upProbability: number;
    targetProb: (target: number) => number;
    expectedMaxDrawdown: number;
    var95: number;
    ci80: [number, number];
    ci95: [number, number];
    summary: string;
}
export declare function runMonteCarlo(input: MonteCarloInput): MonteCarloResult;
export declare function formatMonteCarloForPrompt(r: MonteCarloResult): string;
//# sourceMappingURL=monte-carlo.service.d.ts.map