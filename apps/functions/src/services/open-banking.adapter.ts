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

import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { BankAccount, Transaction } from '../types/butler.types';
import { TAIWAN_BANKS } from './finance.service';

const db = admin.firestore();

// ================================
// Open Banking Types
// ================================

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

// ================================
// Open Banking Adapter
// ================================

export class TaiwanOpenBankingAdapter {
    private clientId: string;
    private clientSecret: string;

    constructor() {
        this.clientId = process.env.OPEN_BANKING_CLIENT_ID || '';
        this.clientSecret = process.env.OPEN_BANKING_CLIENT_SECRET || '';
    }

    /**
     * Check if Open Banking is configured
     */
    isConfigured(): boolean {
        return !!(this.clientId && this.clientSecret);
    }

    /**
     * Get authorization URL for user consent
     */
    getAuthorizationUrl(bankCode: keyof typeof TAIWAN_BANKS, redirectUri: string, state: string): string {
        // Each bank has its own OAuth endpoints
        const authEndpoints: Record<string, string> = {
            '808': 'https://openapi.esunbank.com.tw/oauth/authorize',
            '822': 'https://openapi.ctbcbank.com/oauth2/authorize',
            '004': 'https://fapi.bot.com.tw/oauth/authorize',
            '007': 'https://openapi.firstbank.com.tw/oauth2/authorize',
        };
        
        const scope = 'accounts transactions balance';
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope,
            state,
        });
        
        return `${authEndpoints[bankCode]}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(
        bankCode: keyof typeof TAIWAN_BANKS,
        code: string,
        redirectUri: string
    ): Promise<OpenBankingTokens> {
        const tokenEndpoints: Record<string, string> = {
            '808': 'https://openapi.esunbank.com.tw/oauth/token',
            '822': 'https://openapi.ctbcbank.com/oauth2/token',
            '004': 'https://fapi.bot.com.tw/oauth/token',
            '007': 'https://openapi.firstbank.com.tw/oauth2/token',
        };
        
        const response = await fetch(tokenEndpoints[bankCode], {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
            }),
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${response.status} - ${error}`);
        }
        
        const data = await response.json() as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            scope: string;
        };
        
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
            scope: data.scope.split(' '),
        };
    }

    /**
     * Store user's bank connection tokens
     */
    async storeConnection(
        uid: string,
        bankCode: string,
        tokens: OpenBankingTokens,
        accountInfo: Partial<BankAccount>
    ): Promise<void> {
        await db.doc(`users/${uid}/butler/integrations/banks/${bankCode}`).set({
            ...tokens,
            bankCode,
            accountInfo,
            connectedAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        });
    }

    /**
     * Get stored connection tokens
     */
    async getConnection(uid: string, bankCode: string): Promise<OpenBankingTokens | null> {
        const doc = await db.doc(`users/${uid}/butler/integrations/banks/${bankCode}`).get();
        if (!doc.exists) return null;
        
        const data = doc.data();
        if (!data) return null;
        
        // Check if token is expired
        if (data.expiresAt && data.expiresAt < Date.now()) {
            // Attempt refresh
            try {
                const newTokens = await this.refreshTokens(bankCode as keyof typeof TAIWAN_BANKS, data.refreshToken);
                await db.doc(`users/${uid}/butler/integrations/banks/${bankCode}`).update({
                    ...newTokens,
                    updatedAt: admin.firestore.Timestamp.now(),
                });
                return newTokens;
            } catch {
                logger.error('Token refresh failed, user needs to re-authorize');
                return null;
            }
        }
        
        return {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
            scope: data.scope,
        };
    }

    /**
     * Refresh access token
     */
    async refreshTokens(
        bankCode: keyof typeof TAIWAN_BANKS,
        refreshToken: string
    ): Promise<OpenBankingTokens> {
        const tokenEndpoints: Record<string, string> = {
            '808': 'https://openapi.esunbank.com.tw/oauth/token',
            '822': 'https://openapi.ctbcbank.com/oauth2/token',
            '004': 'https://fapi.bot.com.tw/oauth/token',
            '007': 'https://openapi.firstbank.com.tw/oauth2/token',
        };
        
        const response = await fetch(tokenEndpoints[bankCode], {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
        });
        
        if (!response.ok) {
            throw new Error(`Token refresh failed: ${response.status}`);
        }
        
        const data = await response.json() as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            scope: string;
        };
        
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
            scope: data.scope.split(' '),
        };
    }

    /**
     * Fetch accounts from bank
     */
    async fetchAccounts(uid: string, bankCode: keyof typeof TAIWAN_BANKS): Promise<OpenBankingAccount[]> {
        const tokens = await this.getConnection(uid, bankCode);
        if (!tokens) {
            throw new Error(`Bank ${bankCode} not connected`);
        }
        
        const bank = TAIWAN_BANKS[bankCode];
        const response = await fetch(`${bank.apiBase}/v1/accounts`, {
            headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch accounts: ${response.status}`);
        }
        
        const data = await response.json() as { accounts: OpenBankingAccount[] };
        return data.accounts;
    }

    /**
     * Fetch transactions from bank
     */
    async fetchTransactions(
        uid: string,
        bankCode: keyof typeof TAIWAN_BANKS,
        accountId: string,
        startDate: string,
        endDate: string
    ): Promise<OpenBankingTransaction[]> {
        const tokens = await this.getConnection(uid, bankCode);
        if (!tokens) {
            throw new Error(`Bank ${bankCode} not connected`);
        }
        
        const bank = TAIWAN_BANKS[bankCode];
        const params = new URLSearchParams({
            accountId,
            fromDate: startDate,
            toDate: endDate,
        });
        
        const response = await fetch(`${bank.apiBase}/v1/transactions?${params}`, {
            headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch transactions: ${response.status}`);
        }
        
        const data = await response.json() as { transactions: OpenBankingTransaction[] };
        return data.transactions;
    }

    /**
     * Sync transactions to Firestore
     */
    async syncTransactionsToFirestore(
        uid: string,
        bankCode: keyof typeof TAIWAN_BANKS,
        accountId: string,
        days: number = 30
    ): Promise<number> {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const transactions = await this.fetchTransactions(uid, bankCode, accountId, startDate, endDate);
        const batch = db.batch();
        let count = 0;
        
        for (const tx of transactions) {
            const docRef = db.doc(`users/${uid}/butler/finance/transactions/${tx.transactionId}`);
            
            const transaction: Omit<Transaction, 'id'> = {
                bankAccountId: accountId,
                type: tx.direction === 'credit' ? 'income' : 'expense',
                amount: Math.abs(tx.amount),
                category: tx.category || '其他',
                description: tx.description,
                date: tx.transactionDate,
                source: 'open_banking',
                createdAt: admin.firestore.Timestamp.now(),
            };
            
            batch.set(docRef, { id: tx.transactionId, ...transaction }, { merge: true });
            count++;
        }
        
        await batch.commit();
        return count;
    }

    /**
     * Get balance for all connected accounts
     */
    async getAllBalances(uid: string): Promise<AccountBalance[]> {
        const balances: AccountBalance[] = [];
        
        for (const bankCode of Object.keys(TAIWAN_BANKS) as Array<keyof typeof TAIWAN_BANKS>) {
            try {
                const connection = await this.getConnection(uid, bankCode);
                if (!connection) continue;
                
                const accounts = await this.fetchAccounts(uid, bankCode);
                const bank = TAIWAN_BANKS[bankCode];
                
                for (const account of accounts) {
                    balances.push({
                        bankCode,
                        bankName: bank.name,
                        accountId: account.accountId,
                        accountNumber: `****${account.accountNumber.slice(-4)}`,
                        balance: account.balance,
                        availableBalance: account.availableBalance,
                        currency: account.currency,
                    });
                }
            } catch (error) {
                logger.error(`Failed to fetch balance for ${bankCode}:`, error);
            }
        }
        
        return balances;
    }
}

// ================================
// Types
// ================================

export interface AccountBalance {
    bankCode: string;
    bankName: string;
    accountId: string;
    accountNumber: string;
    balance: number;
    availableBalance: number;
    currency: string;
}

export const openBankingAdapter = new TaiwanOpenBankingAdapter();
