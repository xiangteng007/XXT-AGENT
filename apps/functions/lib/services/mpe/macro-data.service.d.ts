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
export interface MacroSnapshot {
    timestamp: Date;
    dxy: number;
    vix: number;
    us10y: number;
    twdUsd: number;
    fedFundsTarget: number;
    fedHikeProb: number;
    taiwanCbcRate: number;
    spx500: number;
    qqq: number;
    gold: number;
    crude: number;
    source: 'live' | 'cache';
}
export interface MacroRegime {
    riskMode: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
    dollarStrength: 'STRONG' | 'NEUTRAL' | 'WEAK';
    rateEnvironment: 'HAWKISH' | 'NEUTRAL' | 'DOVISH';
    volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    description: string;
}
export declare function fetchMacroSnapshot(): Promise<MacroSnapshot>;
/**
 * 根據總經指標判斷目前市場環境
 */
export declare function classifyMacroRegime(snap: MacroSnapshot): MacroRegime;
/**
 * 返回格式化的總經摘要字串（供 Ollama prompt 使用）
 */
export declare function formatMacroForPrompt(snap: MacroSnapshot, regime: MacroRegime): string;
//# sourceMappingURL=macro-data.service.d.ts.map