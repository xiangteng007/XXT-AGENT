// Portfolio and position types for investment tracking

export interface Position {
    id: string;
    symbol: string;
    name: string;
    type: 'stock' | 'etf' | 'crypto' | 'future' | 'fx' | 'bond';

    // Quantity and cost
    quantity: number;
    avgCost: number;
    totalCost: number;

    // Current value
    currentPrice: number;
    marketValue: number;

    // P&L
    unrealizedPnL: number;
    unrealizedPnLPct: number;
    realizedPnL: number;

    // Portfolio weight
    weight: number;

    // Risk metrics
    beta?: number;
    dailyVolatility?: number;

    // Metadata
    sector?: string;
    exchange?: string;
    currency: string;
    lastUpdated: string;
}

export interface Transaction {
    id: string;
    positionId: string;
    symbol: string;
    type: 'buy' | 'sell' | 'dividend' | 'split' | 'transfer';
    quantity: number;
    price: number;
    fees: number;
    total: number;
    executedAt: string;
    notes?: string;
}

export interface Portfolio {
    id: string;
    name: string;
    description?: string;
    currency: string;

    // Positions
    positions: Position[];

    // Summary
    totalValue: number;
    totalCost: number;
    cashBalance: number;

    // P&L
    dailyPnL: number;
    dailyPnLPct: number;
    totalPnL: number;
    totalPnLPct: number;

    // Risk metrics
    riskMetrics: RiskMetrics;

    // Allocation
    sectorAllocation: AllocationItem[];
    typeAllocation: AllocationItem[];

    // Metadata
    createdAt: string;
    updatedAt: string;
}

export interface RiskMetrics {
    // Volatility
    dailyVolatility: number;      // Daily standard deviation
    annualizedVolatility: number; // Annualized vol

    // Drawdown
    maxDrawdown: number;          // Maximum drawdown %
    currentDrawdown: number;      // Current drawdown from peak

    // Risk-adjusted returns
    sharpeRatio: number;          // (Return - RiskFree) / Volatility
    sortinoRatio: number;         // Sharpe with downside vol only

    // Market exposure
    beta: number;                 // Correlation to market
    alpha: number;                // Excess return vs benchmark

    // Concentration
    herfindahlIndex: number;      // Position concentration
    top5Weight: number;           // Top 5 holdings weight

    // VaR
    var95: number;                // 95% Value at Risk
    var99: number;                // 99% Value at Risk
}

export interface AllocationItem {
    category: string;
    value: number;
    weight: number;
    pnl: number;
}

export interface PerformancePoint {
    date: string;
    value: number;
    dailyReturn: number;
    cumulativeReturn: number;
    benchmark?: number;
}

// Helper functions

export function calculatePositionPnL(position: Position): { pnl: number; pnlPct: number } {
    const marketValue = position.quantity * position.currentPrice;
    const pnl = marketValue - position.totalCost;
    const pnlPct = position.totalCost > 0 ? (pnl / position.totalCost) * 100 : 0;
    return { pnl, pnlPct };
}

export function calculatePortfolioWeight(position: Position, totalValue: number): number {
    if (totalValue <= 0) return 0;
    return (position.quantity * position.currentPrice / totalValue) * 100;
}

export function createEmptyPortfolio(name: string): Portfolio {
    return {
        id: crypto.randomUUID(),
        name,
        currency: 'TWD',
        positions: [],
        totalValue: 0,
        totalCost: 0,
        cashBalance: 0,
        dailyPnL: 0,
        dailyPnLPct: 0,
        totalPnL: 0,
        totalPnLPct: 0,
        riskMetrics: {
            dailyVolatility: 0,
            annualizedVolatility: 0,
            maxDrawdown: 0,
            currentDrawdown: 0,
            sharpeRatio: 0,
            sortinoRatio: 0,
            beta: 1,
            alpha: 0,
            herfindahlIndex: 0,
            top5Weight: 0,
            var95: 0,
            var99: 0,
        },
        sectorAllocation: [],
        typeAllocation: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export function createPosition(
    symbol: string,
    name: string,
    quantity: number,
    avgCost: number,
    currentPrice: number,
    overrides: Partial<Position> = {}
): Position {
    const totalCost = quantity * avgCost;
    const marketValue = quantity * currentPrice;
    const pnl = marketValue - totalCost;
    const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

    return {
        id: crypto.randomUUID(),
        symbol,
        name,
        type: 'stock',
        quantity,
        avgCost,
        totalCost,
        currentPrice,
        marketValue,
        unrealizedPnL: pnl,
        unrealizedPnLPct: pnlPct,
        realizedPnL: 0,
        weight: 0,
        currency: 'TWD',
        lastUpdated: new Date().toISOString(),
        ...overrides,
    };
}
