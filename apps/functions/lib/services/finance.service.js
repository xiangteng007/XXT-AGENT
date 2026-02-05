"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeService = exports.FinanceService = exports.TRANSACTION_CATEGORIES = exports.TAIWAN_BANKS = void 0;
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// ================================
// Taiwan Bank Configuration
// ================================
exports.TAIWAN_BANKS = {
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
};
// Transaction categories
exports.TRANSACTION_CATEGORIES = {
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
class FinanceService {
    /**
     * Get user's finance profile
     */
    async getFinanceProfile(uid) {
        const doc = await db.doc(`users/${uid}/butler/profile`).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        return data?.financeProfile || null;
    }
    /**
     * Add a bank account
     */
    async addBankAccount(uid, account) {
        const id = `bank_${Date.now()}`;
        const bankAccount = { ...account, id };
        await db.doc(`users/${uid}/butler/profile`).update({
            'financeProfile.bankAccounts': admin.firestore.FieldValue.arrayUnion(bankAccount),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        return id;
    }
    /**
     * Add a credit card
     */
    async addCreditCard(uid, card) {
        const id = `card_${Date.now()}`;
        const creditCard = { ...card, id };
        await db.doc(`users/${uid}/butler/profile`).update({
            'financeProfile.creditCards': admin.firestore.FieldValue.arrayUnion(creditCard),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        return id;
    }
    /**
     * Record a transaction
     */
    async recordTransaction(uid, transaction) {
        const docRef = await db.collection(`users/${uid}/butler/finance/transactions`).add({
            ...transaction,
            createdAt: admin.firestore.Timestamp.now(),
        });
        return docRef.id;
    }
    /**
     * Get transactions for a date range
     */
    async getTransactions(uid, startDate, endDate, options) {
        let query = db.collection(`users/${uid}/butler/finance/transactions`)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'desc');
        if (options?.type) {
            query = query.where('type', '==', options.type);
        }
        const snapshot = await query.get();
        let transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (options?.category) {
            transactions = transactions.filter(t => t.category === options.category);
        }
        return transactions;
    }
    /**
     * Get monthly summary
     */
    async getMonthlySummary(uid, year, month) {
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
        const byCategory = new Map();
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
    async addRecurringPayment(uid, payment) {
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
    async getUpcomingBills(uid, daysAhead = 7) {
        const today = new Date();
        const currentDay = today.getDate();
        // Get recurring payments
        const snapshot = await db.collection(`users/${uid}/butler/finance/recurring`).get();
        const payments = snapshot.docs.map(doc => doc.data());
        // Get credit cards for payment dates
        const profile = await this.getFinanceProfile(uid);
        const creditCards = profile?.creditCards || [];
        const reminders = [];
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
    daysUntilDueDate(currentDay, dueDay) {
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
    categorizeTransaction(description) {
        const lowerDesc = description.toLowerCase();
        // Keyword matching rules
        const rules = [
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
    async getSpendingInsights(uid, months = 3) {
        const today = new Date();
        const summaries = [];
        for (let i = 0; i < months; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const summary = await this.getMonthlySummary(uid, date.getFullYear(), date.getMonth() + 1);
            summaries.push(summary);
        }
        // Calculate averages
        const avgIncome = summaries.reduce((sum, s) => sum + s.totalIncome, 0) / months;
        const avgExpenses = summaries.reduce((sum, s) => sum + s.totalExpenses, 0) / months;
        // Find top expense categories
        const categoryTotals = new Map();
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
    generateSuggestions(topCategories, avgExpenses, avgIncome) {
        const suggestions = [];
        const savingsRate = avgIncome > 0 ? (avgIncome - avgExpenses) / avgIncome : 0;
        // Savings rate suggestions
        if (savingsRate < 0.1) {
            suggestions.push('建議將儲蓄率提升至每月收入的 10% 以上');
        }
        else if (savingsRate >= 0.2) {
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
exports.FinanceService = FinanceService;
exports.financeService = new FinanceService();
//# sourceMappingURL=finance.service.js.map