/**
 * Finance Service
 * 
 * Provides financial management capabilities for the personal butler:
 * - Taiwan Open Banking API integration (E.SUN, CTBC, Taiwan Bank, First Bank)
 * - Transaction categorization and analysis
 * - Budget tracking and alerts
 * - Bill payment reminders
 * - Investment portfolio overview
 */

import * as admin from 'firebase-admin';
import {
    FinanceProfile,
    BankAccount,
    CreditCard,
    Transaction,
    RecurringPayment,
} from '../types/butler.types';

const db = admin.firestore();

// ================================
// Taiwan Bank Configuration
// ================================

export const TAIWAN_BANKS = {
    '808': {
        code: '808',
        name: '玉山銀行',
        englishName: 'E.SUN Bank',
        openBankingSupport: true,
        apiBase: 'https://openapi.esunbank.com.tw',
    },
    '822': {
        code: '822',
        name: '中國信託',
        englishName: 'CTBC Bank',
        openBankingSupport: true,
        apiBase: 'https://openapi.ctbcbank.com',
    },
    '004': {
        code: '004',
        name: '臺灣銀行',
        englishName: 'Bank of Taiwan',
        openBankingSupport: true,
        apiBase: 'https://fapi.bot.com.tw',
    },
    '007': {
        code: '007',
        name: '第一銀行',
        englishName: 'First Bank',
        openBankingSupport: true,
        apiBase: 'https://openapi.firstbank.com.tw',
    },
} as const;

// Transaction categories
export const TRANSACTION_CATEGORIES = {
    income: ['薪資', '獎金', '投資收益', '退款', '其他收入'],
    expense: {
        essential: ['餐飲', '交通', '住宅', '水電瓦斯', '保險', '醫療'],
        lifestyle: ['娛樂', '購物', '旅遊', '訂閱服務', '教育'],
        business: ['營業支出', '設備採購', '人事費用', '稅務'],
        vehicle: ['加油', '保養', '停車', '過路費', '驗車'],
    },
};

// ================================
// Finance Service Class
// ================================

export class FinanceService {
    /**
     * Get user's finance profile
     */
    async getFinanceProfile(uid: string): Promise<FinanceProfile | null> {
        const doc = await db.doc(`users/${uid}/butler/profile`).get();
        if (!doc.exists) return null;
        
        const data = doc.data();
        return data?.financeProfile as FinanceProfile || null;
    }

    /**
     * Add a bank account
     */
    async addBankAccount(uid: string, account: Omit<BankAccount, 'id'>): Promise<string> {
        const id = `bank_${Date.now()}`;
        const bankAccount: BankAccount = { ...account, id };
        
        await db.doc(`users/${uid}/butler/profile`).update({
            'financeProfile.bankAccounts': admin.firestore.FieldValue.arrayUnion(bankAccount),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        
        return id;
    }

    /**
     * Add a credit card
     */
    async addCreditCard(uid: string, card: Omit<CreditCard, 'id'>): Promise<string> {
        const id = `card_${Date.now()}`;
        const creditCard: CreditCard = { ...card, id };
        
        await db.doc(`users/${uid}/butler/profile`).update({
            'financeProfile.creditCards': admin.firestore.FieldValue.arrayUnion(creditCard),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        
        return id;
    }

    /**
     * Record a transaction
     */
    async recordTransaction(uid: string, transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<string> {
        const docRef = await db.collection(`users/${uid}/butler/finance/transactions`).add({
            ...transaction,
            createdAt: admin.firestore.Timestamp.now(),
        });
        
        return docRef.id;
    }

    /**
     * Get transactions for a date range
     */
    async getTransactions(
        uid: string,
        startDate: string,
        endDate: string,
        options?: { category?: string; type?: 'income' | 'expense' | 'transfer' }
    ): Promise<Transaction[]> {
        let query = db.collection(`users/${uid}/butler/finance/transactions`)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'desc');
        
        if (options?.type) {
            query = query.where('type', '==', options.type);
        }
        
        const snapshot = await query.get();
        let transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        
        if (options?.category) {
            transactions = transactions.filter(t => t.category === options.category);
        }
        
        return transactions;
    }

    /**
     * Get monthly summary
     */
    async getMonthlySummary(uid: string, year: number, month: number): Promise<MonthlySummary> {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
        
        const transactions = await this.getTransactions(uid, startDate, endDate);
        
        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const expenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        
        // Group by category
        const byCategory = new Map<string, number>();
        transactions
            .filter(t => t.type === 'expense')
            .forEach(t => {
                const current = byCategory.get(t.category) || 0;
                byCategory.set(t.category, current + t.amount);
            });
        
        return {
            year,
            month,
            totalIncome: income,
            totalExpenses: expenses,
            netSavings: income - expenses,
            savingsRate: income > 0 ? Math.round((income - expenses) / income * 100) : 0,
            expensesByCategory: Object.fromEntries(byCategory),
            transactionCount: transactions.length,
        };
    }

    /**
     * Add recurring payment
     */
    async addRecurringPayment(uid: string, payment: Omit<RecurringPayment, 'id'>): Promise<string> {
        const id = `recur_${Date.now()}`;
        
        await db.collection(`users/${uid}/butler/finance/recurring`).doc(id).set({
            ...payment,
            id,
            createdAt: admin.firestore.Timestamp.now(),
        });
        
        return id;
    }

    /**
     * Get upcoming bill reminders
     */
    async getUpcomingBills(uid: string, daysAhead: number = 7): Promise<BillReminder[]> {
        const today = new Date();
        const currentDay = today.getDate();
        
        // Get recurring payments
        const snapshot = await db.collection(`users/${uid}/butler/finance/recurring`).get();
        const payments = snapshot.docs.map(doc => doc.data() as RecurringPayment);
        
        // Get credit cards for payment dates
        const profile = await this.getFinanceProfile(uid);
        const creditCards = profile?.creditCards || [];
        
        const reminders: BillReminder[] = [];
        
        // Check recurring payments
        for (const payment of payments) {
            const daysUntil = this.daysUntilDueDate(currentDay, payment.dueDay);
            if (daysUntil <= daysAhead) {
                reminders.push({
                    type: 'recurring',
                    name: payment.name,
                    dueDay: payment.dueDay,
                    daysUntil,
                    amount: payment.amount,
                    isAutoDebit: payment.isAutoDebit,
                });
            }
        }
        
        // Check credit card payments
        for (const card of creditCards) {
            const daysUntil = this.daysUntilDueDate(currentDay, card.paymentDueDay);
            if (daysUntil <= daysAhead) {
                reminders.push({
                    type: 'credit_card',
                    name: `${card.issuerBank} ${card.cardName}`,
                    dueDay: card.paymentDueDay,
                    daysUntil,
                    isAutoDebit: false,
                });
            }
        }
        
        // Sort by days until due
        return reminders.sort((a, b) => a.daysUntil - b.daysUntil);
    }

    /**
     * Calculate days until due date
     */
    private daysUntilDueDate(currentDay: number, dueDay: number): number {
        if (dueDay >= currentDay) {
            return dueDay - currentDay;
        }
        // Next month
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        return daysInMonth - currentDay + dueDay;
    }

    /**
     * Auto-categorize transaction based on description
     */
    categorizeTransaction(description: string): { category: string; confidence: number } {
        const lowerDesc = description.toLowerCase();
        
        // Keyword matching rules
        const rules: { keywords: string[]; category: string }[] = [
            { keywords: ['薪資', 'salary', '薪水'], category: '薪資' },
            { keywords: ['7-11', '全家', '萊爾富', '便利商店', 'familymart'], category: '餐飲' },
            { keywords: ['ubereats', 'foodpanda', '外送'], category: '餐飲' },
            { keywords: ['加油', 'cpc', '中油', '台塑', 'gas'], category: '加油' },
            { keywords: ['停車', 'parking'], category: '停車' },
            { keywords: ['etag', '國道', '高速公路'], category: '過路費' },
            { keywords: ['netflix', 'spotify', 'disney+', 'youtube premium', '訂閱'], category: '訂閱服務' },
            { keywords: ['台電', '水費', '瓦斯', '電費'], category: '水電瓦斯' },
            { keywords: ['全聯', '家樂福', '好市多', 'costco', '大潤發'], category: '購物' },
            { keywords: ['台鐵', '高鐵', '捷運', '悠遊卡'], category: '交通' },
            { keywords: ['保險', 'insurance'], category: '保險' },
            { keywords: ['醫院', '診所', '藥局'], category: '醫療' },
        ];
        
        for (const rule of rules) {
            if (rule.keywords.some(k => lowerDesc.includes(k))) {
                return { category: rule.category, confidence: 0.9 };
            }
        }
        
        return { category: '其他', confidence: 0.1 };
    }

    /**
     * Get spending insights
     */
    async getSpendingInsights(uid: string, months: number = 3): Promise<SpendingInsights> {
        const today = new Date();
        const summaries: MonthlySummary[] = [];
        
        for (let i = 0; i < months; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const summary = await this.getMonthlySummary(uid, date.getFullYear(), date.getMonth() + 1);
            summaries.push(summary);
        }
        
        // Calculate averages
        const avgIncome = summaries.reduce((sum, s) => sum + s.totalIncome, 0) / months;
        const avgExpenses = summaries.reduce((sum, s) => sum + s.totalExpenses, 0) / months;
        
        // Find top expense categories
        const categoryTotals = new Map<string, number>();
        summaries.forEach(s => {
            Object.entries(s.expensesByCategory).forEach(([cat, amount]) => {
                const current = categoryTotals.get(cat) || 0;
                categoryTotals.set(cat, current + amount);
            });
        });
        
        const topCategories = Array.from(categoryTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([category, amount]) => ({ category, amount: Math.round(amount / months) }));
        
        // Spending trend
        const trend = summaries.length >= 2
            ? summaries[0].totalExpenses > summaries[1].totalExpenses
                ? 'increasing'
                : summaries[0].totalExpenses < summaries[1].totalExpenses
                    ? 'decreasing'
                    : 'stable'
            : 'stable';
        
        return {
            period: `過去 ${months} 個月`,
            averageMonthlyIncome: Math.round(avgIncome),
            averageMonthlyExpenses: Math.round(avgExpenses),
            averageSavingsRate: avgIncome > 0 ? Math.round((avgIncome - avgExpenses) / avgIncome * 100) : 0,
            topExpenseCategories: topCategories,
            spendingTrend: trend,
            suggestions: this.generateSuggestions(topCategories, avgExpenses, avgIncome),
        };
    }

    /**
     * Generate financial suggestions
     */
    private generateSuggestions(
        topCategories: { category: string; amount: number }[],
        avgExpenses: number,
        avgIncome: number
    ): string[] {
        const suggestions: string[] = [];
        const savingsRate = avgIncome > 0 ? (avgIncome - avgExpenses) / avgIncome : 0;
        
        // Savings rate suggestions
        if (savingsRate < 0.1) {
            suggestions.push('建議將儲蓄率提升至每月收入的 10% 以上');
        } else if (savingsRate >= 0.2) {
            suggestions.push('儲蓄率良好！可考慮增加投資配置');
        }
        
        // Category-specific suggestions
        const foodExpense = topCategories.find(c => c.category === '餐飲');
        if (foodExpense && foodExpense.amount > avgIncome * 0.15) {
            suggestions.push('餐飲支出偏高，建議多在家烹飪可節省開支');
        }
        
        const subscriptions = topCategories.find(c => c.category === '訂閱服務');
        if (subscriptions && subscriptions.amount > 2000) {
            suggestions.push('訂閱服務支出偏多，建議檢視是否有未使用的訂閱');
        }
        
        // Vehicle expenses (for Jimny owner)
        const vehicleExpenses = topCategories
            .filter(c => ['加油', '停車', '過路費', '保養'].includes(c.category))
            .reduce((sum, c) => sum + c.amount, 0);
        if (vehicleExpenses > avgIncome * 0.1) {
            suggestions.push('車輛相關支出佔收入比例較高，可考慮減少非必要行程');
        }
        
        return suggestions;
    }
}

// ================================
// Types
// ================================

export interface MonthlySummary {
    year: number;
    month: number;
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number;
    expensesByCategory: Record<string, number>;
    transactionCount: number;
}

export interface BillReminder {
    type: 'recurring' | 'credit_card';
    name: string;
    dueDay: number;
    daysUntil: number;
    amount?: number;
    isAutoDebit: boolean;
}

export interface SpendingInsights {
    period: string;
    averageMonthlyIncome: number;
    averageMonthlyExpenses: number;
    averageSavingsRate: number;
    topExpenseCategories: { category: string; amount: number }[];
    spendingTrend: 'increasing' | 'decreasing' | 'stable';
    suggestions: string[];
}

export const financeService = new FinanceService();
