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
export interface InstitutionalFlow {
    date: string;
    symbol: string;
    foreignBuyNet: number;
    investTrustBuyNet: number;
    dealerBuyNet: number;
    totalInstitutionalNet: number;
}
export interface MarginBalance {
    date: string;
    symbol: string;
    marginBalance: number;
    marginBalanceChange: number;
    shortBalance: number;
    shortBalanceChange: number;
    shortRatio: number;
}
export interface FundamentalSnapshot {
    symbol: string;
    date: string;
    institutional: InstitutionalFlow | null;
    margin: MarginBalance | null;
    foreignOwnership: number;
    pe: number;
    pb: number;
    dividend: number;
}
export declare function fetchInstitutionalFlow(symbol: string, date?: string): Promise<InstitutionalFlow | null>;
export declare function fetchMarginBalance(symbol: string, days?: number): Promise<MarginBalance | null>;
export declare function fetchFundamentalSnapshot(symbol: string): Promise<FundamentalSnapshot>;
export declare function formatFundamentalForPrompt(snap: FundamentalSnapshot): string;
//# sourceMappingURL=fundamental-data.service.d.ts.map