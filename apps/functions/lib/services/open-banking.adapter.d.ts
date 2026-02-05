/**
 * Taiwan Open Banking Adapter
 *
 * Handles Taiwan Open Banking API integration for:
 * - E.SUN Bank (808)
 * - CTBC Bank (822)
 * - Bank of Taiwan (004)
 * - First Bank (007)
 *
 * Note: Actual Open Banking integration requires:
 * 1. TSP (Third-party Service Provider) registration with FSC
 * 2. OAuth 2.0 flow with each bank
 * 3. User consent through bank's app
 */
import { BankAccount } from '../types/butler.types';
import { TAIWAN_BANKS } from './finance.service';
interface OpenBankingTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope: string[];
}
interface OpenBankingAccount {
    accountId: string;
    accountNumber: string;
    accountType: 'savings' | 'checking' | 'deposit';
    currency: 'TWD' | 'USD' | 'EUR';
    balance: number;
    availableBalance: number;
}
interface OpenBankingTransaction {
    transactionId: string;
    accountId: string;
    amount: number;
    currency: string;
    direction: 'credit' | 'debit';
    description: string;
    category?: string;
    merchantName?: string;
    transactionDate: string;
    valueDate: string;
    balance?: number;
}
export declare class TaiwanOpenBankingAdapter {
    private clientId;
    private clientSecret;
    constructor();
    /**
     * Check if Open Banking is configured
     */
    isConfigured(): boolean;
    /**
     * Get authorization URL for user consent
     */
    getAuthorizationUrl(bankCode: keyof typeof TAIWAN_BANKS, redirectUri: string, state: string): string;
    /**
     * Exchange authorization code for tokens
     */
    exchangeCodeForTokens(bankCode: keyof typeof TAIWAN_BANKS, code: string, redirectUri: string): Promise<OpenBankingTokens>;
    /**
     * Store user's bank connection tokens
     */
    storeConnection(uid: string, bankCode: string, tokens: OpenBankingTokens, accountInfo: Partial<BankAccount>): Promise<void>;
    /**
     * Get stored connection tokens
     */
    getConnection(uid: string, bankCode: string): Promise<OpenBankingTokens | null>;
    /**
     * Refresh access token
     */
    refreshTokens(bankCode: keyof typeof TAIWAN_BANKS, refreshToken: string): Promise<OpenBankingTokens>;
    /**
     * Fetch accounts from bank
     */
    fetchAccounts(uid: string, bankCode: keyof typeof TAIWAN_BANKS): Promise<OpenBankingAccount[]>;
    /**
     * Fetch transactions from bank
     */
    fetchTransactions(uid: string, bankCode: keyof typeof TAIWAN_BANKS, accountId: string, startDate: string, endDate: string): Promise<OpenBankingTransaction[]>;
    /**
     * Sync transactions to Firestore
     */
    syncTransactionsToFirestore(uid: string, bankCode: keyof typeof TAIWAN_BANKS, accountId: string, days?: number): Promise<number>;
    /**
     * Get balance for all connected accounts
     */
    getAllBalances(uid: string): Promise<AccountBalance[]>;
}
export interface AccountBalance {
    bankCode: string;
    bankName: string;
    accountId: string;
    accountNumber: string;
    balance: number;
    availableBalance: number;
    currency: string;
}
export declare const openBankingAdapter: TaiwanOpenBankingAdapter;
export {};
//# sourceMappingURL=open-banking.adapter.d.ts.map