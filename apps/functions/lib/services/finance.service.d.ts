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
import { FinanceProfile, BankAccount, CreditCard, Transaction, RecurringPayment } from '../types/butler.types';
export declare const TAIWAN_BANKS: {
    readonly '808': {
        readonly code: "808";
        readonly name: "玉山銀行";
        readonly englishName: "E.SUN Bank";
        readonly openBankingSupport: true;
        readonly apiBase: "https://openapi.esunbank.com.tw";
    };
    readonly '822': {
        readonly code: "822";
        readonly name: "中國信託";
        readonly englishName: "CTBC Bank";
        readonly openBankingSupport: true;
        readonly apiBase: "https://openapi.ctbcbank.com";
    };
    readonly '004': {
        readonly code: "004";
        readonly name: "臺灣銀行";
        readonly englishName: "Bank of Taiwan";
        readonly openBankingSupport: true;
        readonly apiBase: "https://fapi.bot.com.tw";
    };
    readonly '007': {
        readonly code: "007";
        readonly name: "第一銀行";
        readonly englishName: "First Bank";
        readonly openBankingSupport: true;
        readonly apiBase: "https://openapi.firstbank.com.tw";
    };
};
export declare const TRANSACTION_CATEGORIES: {
    income: string[];
    expense: {
        essential: string[];
        lifestyle: string[];
        business: string[];
        vehicle: string[];
    };
};
export declare class FinanceService {
    /**
     * Get user's finance profile
     */
    getFinanceProfile(uid: string): Promise<FinanceProfile | null>;
    /**
     * Add a bank account
     */
    addBankAccount(uid: string, account: Omit<BankAccount, 'id'>): Promise<string>;
    /**
     * Add a credit card
     */
    addCreditCard(uid: string, card: Omit<CreditCard, 'id'>): Promise<string>;
    /**
     * Record a transaction
     */
    recordTransaction(uid: string, transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<string>;
    /**
     * Get transactions for a date range
     */
    getTransactions(uid: string, startDate: string, endDate: string, options?: {
        category?: string;
        type?: 'income' | 'expense' | 'transfer';
    }): Promise<Transaction[]>;
    /**
     * Get monthly summary
     */
    getMonthlySummary(uid: string, year: number, month: number): Promise<MonthlySummary>;
    /**
     * Add recurring payment
     */
    addRecurringPayment(uid: string, payment: Omit<RecurringPayment, 'id'>): Promise<string>;
    /**
     * Get upcoming bill reminders
     */
    getUpcomingBills(uid: string, daysAhead?: number): Promise<BillReminder[]>;
    /**
     * Calculate days until due date
     */
    private daysUntilDueDate;
    /**
     * Auto-categorize transaction based on description
     */
    categorizeTransaction(description: string): {
        category: string;
        confidence: number;
    };
    /**
     * Get spending insights
     */
    getSpendingInsights(uid: string, months?: number): Promise<SpendingInsights>;
    /**
     * Generate financial suggestions
     */
    private generateSuggestions;
}
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
    topExpenseCategories: {
        category: string;
        amount: number;
    }[];
    spendingTrend: 'increasing' | 'decreasing' | 'stable';
    suggestions: string[];
}
export declare const financeService: FinanceService;
//# sourceMappingURL=finance.service.d.ts.map