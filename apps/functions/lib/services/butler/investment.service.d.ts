/**
 * Investment Portfolio Service
 *
 * Tracks investment holdings, trades, dividends, and provides
 * portfolio analysis with Taiwan stock market support.
 */
import { InvestmentHolding, InvestmentTransaction } from '../../types/butler.types';
export declare class InvestmentService {
    /**
     * Add or update a holding
     */
    addHolding(uid: string, holding: Omit<InvestmentHolding, 'id' | 'lastUpdated'>): Promise<string>;
    /**
     * Record an investment trade (buy/sell/dividend)
     */
    recordTrade(uid: string, trade: Omit<InvestmentTransaction, 'id' | 'createdAt'>): Promise<string>;
    /**
     * Get portfolio summary
     */
    getPortfolioSummary(uid: string): Promise<PortfolioSummary>;
    /**
     * Get asset allocation breakdown
     */
    getAssetAllocation(uid: string): Promise<AssetAllocation[]>;
    /**
     * Generate investment advice based on portfolio
     */
    getInvestmentAdvice(portfolio: PortfolioSummary, allocation: AssetAllocation[]): string[];
    /**
     * Get recent trades
     */
    getRecentTrades(uid: string, limit?: number): Promise<InvestmentTransaction[]>;
}
export interface PortfolioSummary {
    holdings: InvestmentHolding[];
    totalCost: number;
    totalMarketValue: number;
    totalUnrealizedPnL: number;
    returnRate: number;
    holdingCount: number;
}
export interface AssetAllocation {
    type: string;
    label: string;
    value: number;
    percentage: number;
}
export declare const investmentService: InvestmentService;
//# sourceMappingURL=investment.service.d.ts.map