/**
 * Investment Portfolio Service
 *
 * Tracks investment holdings, trades, dividends, and provides
 * portfolio analysis with Taiwan stock market support.
 */

import * as admin from 'firebase-admin';
import {
    InvestmentHolding,
    InvestmentTransaction,
} from '../../types/butler.types';

const db = admin.firestore();

// Common Taiwan ETFs for quick lookup
const TW_POPULAR_ETFS: Record<string, string> = {
    '0050': '元大台灣50',
    '0056': '元大高股息',
    '00878': '國泰永續高股息',
    '00713': '元大台灣高息低波',
    '006208': '富邦台50',
    '00919': '群益台灣精選高息',
    '00929': '復華台灣科技優息',
    '00940': '元大台灣價值高息',
};

const TW_BLUE_CHIPS: Record<string, string> = {
    '2330': '台積電',
    '2317': '鴻海',
    '2454': '聯發科',
    '2308': '台達電',
    '2881': '富邦金',
    '2882': '國泰金',
    '2303': '聯電',
    '2412': '中華電',
};

export class InvestmentService {
    /**
     * Add or update a holding
     */
    async addHolding(uid: string, holding: Omit<InvestmentHolding, 'id' | 'lastUpdated'>): Promise<string> {
        const name = holding.name || TW_POPULAR_ETFS[holding.symbol] || TW_BLUE_CHIPS[holding.symbol] || holding.symbol;
        const docRef = await db.collection(`users/${uid}/butler/finance/investments`).add({
            ...holding,
            name,
            marketValue: holding.shares * (holding.currentPrice || holding.avgCost),
            unrealizedPnL: holding.currentPrice
                ? (holding.currentPrice - holding.avgCost) * holding.shares
                : 0,
            lastUpdated: admin.firestore.Timestamp.now(),
        });
        return docRef.id;
    }

    /**
     * Record an investment trade (buy/sell/dividend)
     */
    async recordTrade(uid: string, trade: Omit<InvestmentTransaction, 'id' | 'createdAt'>): Promise<string> {
        // Record the trade
        const docRef = await db.collection(`users/${uid}/butler/finance/investment_trades`).add({
            ...trade,
            createdAt: admin.firestore.Timestamp.now(),
        });

        // Update holding
        const holdingsRef = db.collection(`users/${uid}/butler/finance/investments`);
        const existing = await holdingsRef.where('symbol', '==', trade.symbol).limit(1).get();

        if (trade.type === 'buy') {
            if (!existing.empty) {
                const doc = existing.docs[0];
                const data = doc.data() as InvestmentHolding;
                const totalShares = data.shares + trade.shares;
                const totalCost = data.shares * data.avgCost + trade.totalAmount;
                await doc.ref.update({
                    shares: totalShares,
                    avgCost: Math.round(totalCost / totalShares * 100) / 100,
                    lastUpdated: admin.firestore.Timestamp.now(),
                });
            } else {
                await this.addHolding(uid, {
                    symbol: trade.symbol,
                    name: TW_POPULAR_ETFS[trade.symbol] || TW_BLUE_CHIPS[trade.symbol] || trade.symbol,
                    type: trade.symbol.length <= 4 && /^\d+$/.test(trade.symbol) ? 'tw_stock' : 'us_stock',
                    shares: trade.shares,
                    avgCost: trade.price,
                    currency: /^\d+$/.test(trade.symbol) ? 'TWD' : 'USD',
                });
            }
        } else if (trade.type === 'sell' && !existing.empty) {
            const doc = existing.docs[0];
            const data = doc.data() as InvestmentHolding;
            const remaining = data.shares - trade.shares;
            if (remaining <= 0) {
                await doc.ref.delete();
            } else {
                await doc.ref.update({
                    shares: remaining,
                    lastUpdated: admin.firestore.Timestamp.now(),
                });
            }
        }

        return docRef.id;
    }

    /**
     * Get portfolio summary
     */
    async getPortfolioSummary(uid: string): Promise<PortfolioSummary> {
        const snapshot = await db.collection(`users/${uid}/butler/finance/investments`).get();
        const holdings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvestmentHolding));

        const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.avgCost, 0);
        const totalValue = holdings.reduce((sum, h) => sum + (h.marketValue || h.shares * h.avgCost), 0);
        const totalPnL = totalValue - totalCost;

        return {
            holdings,
            totalCost: Math.round(totalCost),
            totalMarketValue: Math.round(totalValue),
            totalUnrealizedPnL: Math.round(totalPnL),
            returnRate: totalCost > 0 ? Math.round(totalPnL / totalCost * 10000) / 100 : 0,
            holdingCount: holdings.length,
        };
    }

    /**
     * Get asset allocation breakdown
     */
    async getAssetAllocation(uid: string): Promise<AssetAllocation[]> {
        const snapshot = await db.collection(`users/${uid}/butler/finance/investments`).get();
        const holdings = snapshot.docs.map(doc => doc.data() as InvestmentHolding);

        const typeMap = new Map<string, number>();
        holdings.forEach(h => {
            const value = h.marketValue || h.shares * h.avgCost;
            typeMap.set(h.type, (typeMap.get(h.type) || 0) + value);
        });

        const total = Array.from(typeMap.values()).reduce((a, b) => a + b, 0);
        const typeLabels: Record<string, string> = {
            tw_stock: '台股', us_stock: '美股', etf: 'ETF',
            fund: '基金', bond: '債券', crypto: '加密貨幣',
        };

        return Array.from(typeMap.entries())
            .map(([type, value]) => ({
                type,
                label: typeLabels[type] || type,
                value: Math.round(value),
                percentage: total > 0 ? Math.round(value / total * 100) : 0,
            }))
            .sort((a, b) => b.value - a.value);
    }

    /**
     * Generate investment advice based on portfolio
     */
    getInvestmentAdvice(portfolio: PortfolioSummary, allocation: AssetAllocation[]): string[] {
        const advice: string[] = [];

        if (portfolio.holdingCount === 0) {
            advice.push('📌 尚未建立投資組合。建議先從指數型 ETF（如 0050、006208）開始');
            return advice;
        }

        // Diversification check
        if (portfolio.holdingCount < 3) {
            advice.push('⚠️ 持股過於集中，建議分散至 5 檔以上降低風險');
        }

        // ETF ratio
        const etfRatio = allocation.find(a => a.type === 'etf')?.percentage || 0;
        if (etfRatio < 30) {
            advice.push('💡 ETF 比例偏低，適度增加 ETF（如 0050）可降低個股風險');
        }

        // Single stock dominance
        const maxHolding = portfolio.holdings.reduce((max, h) => {
            const v = h.marketValue || h.shares * h.avgCost;
            return v > max.value ? { symbol: h.symbol, value: v } : max;
        }, { symbol: '', value: 0 });
        if (portfolio.totalMarketValue > 0 && maxHolding.value / portfolio.totalMarketValue > 0.4) {
            advice.push(`⚠️ ${maxHolding.symbol} 佔比超過 40%，建議適度減碼分散`);
        }

        // Return rate
        if (portfolio.returnRate < -10) {
            advice.push('📉 整體虧損超過 10%，建議檢視虧損部位是否需要停損');
        } else if (portfolio.returnRate > 30) {
            advice.push('📈 報酬率優秀！可考慮適度獲利了結，鎖定部分獲利');
        }

        // Taiwan-specific
        const hasTwStock = allocation.some(a => a.type === 'tw_stock');
        const hasUsStock = allocation.some(a => a.type === 'us_stock');
        if (hasTwStock && !hasUsStock) {
            advice.push('🌍 目前只有台股，建議配置部分美股/全球 ETF 降低單一市場風險');
        }

        return advice;
    }

    /**
     * Get recent trades
     */
    async getRecentTrades(uid: string, limit: number = 10): Promise<InvestmentTransaction[]> {
        const snapshot = await db.collection(`users/${uid}/butler/finance/investment_trades`)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvestmentTransaction));
    }
}

// ================================
// Types
// ================================

export interface PortfolioSummary {
    holdings: InvestmentHolding[];
    totalCost: number;
    totalMarketValue: number;
    totalUnrealizedPnL: number;
    returnRate: number; // percentage
    holdingCount: number;
}

export interface AssetAllocation {
    type: string;
    label: string;
    value: number;
    percentage: number;
}

export const investmentService = new InvestmentService();
