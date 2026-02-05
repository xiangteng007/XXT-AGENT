"use strict";
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
exports.openBankingAdapter = exports.TaiwanOpenBankingAdapter = void 0;
const admin = __importStar(require("firebase-admin"));
const finance_service_1 = require("./finance.service");
const db = admin.firestore();
// ================================
// Open Banking Adapter
// ================================
class TaiwanOpenBankingAdapter {
    clientId;
    clientSecret;
    constructor() {
        this.clientId = process.env.OPEN_BANKING_CLIENT_ID || '';
        this.clientSecret = process.env.OPEN_BANKING_CLIENT_SECRET || '';
    }
    /**
     * Check if Open Banking is configured
     */
    isConfigured() {
        return !!(this.clientId && this.clientSecret);
    }
    /**
     * Get authorization URL for user consent
     */
    getAuthorizationUrl(bankCode, redirectUri, state) {
        // Each bank has its own OAuth endpoints
        const authEndpoints = {
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
    async exchangeCodeForTokens(bankCode, code, redirectUri) {
        const tokenEndpoints = {
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
        const data = await response.json();
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
    async storeConnection(uid, bankCode, tokens, accountInfo) {
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
    async getConnection(uid, bankCode) {
        const doc = await db.doc(`users/${uid}/butler/integrations/banks/${bankCode}`).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        if (!data)
            return null;
        // Check if token is expired
        if (data.expiresAt && data.expiresAt < Date.now()) {
            // Attempt refresh
            try {
                const newTokens = await this.refreshTokens(bankCode, data.refreshToken);
                await db.doc(`users/${uid}/butler/integrations/banks/${bankCode}`).update({
                    ...newTokens,
                    updatedAt: admin.firestore.Timestamp.now(),
                });
                return newTokens;
            }
            catch {
                console.error('Token refresh failed, user needs to re-authorize');
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
    async refreshTokens(bankCode, refreshToken) {
        const tokenEndpoints = {
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
        const data = await response.json();
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
    async fetchAccounts(uid, bankCode) {
        const tokens = await this.getConnection(uid, bankCode);
        if (!tokens) {
            throw new Error(`Bank ${bankCode} not connected`);
        }
        const bank = finance_service_1.TAIWAN_BANKS[bankCode];
        const response = await fetch(`${bank.apiBase}/v1/accounts`, {
            headers: {
                'Authorization': `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch accounts: ${response.status}`);
        }
        const data = await response.json();
        return data.accounts;
    }
    /**
     * Fetch transactions from bank
     */
    async fetchTransactions(uid, bankCode, accountId, startDate, endDate) {
        const tokens = await this.getConnection(uid, bankCode);
        if (!tokens) {
            throw new Error(`Bank ${bankCode} not connected`);
        }
        const bank = finance_service_1.TAIWAN_BANKS[bankCode];
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
        const data = await response.json();
        return data.transactions;
    }
    /**
     * Sync transactions to Firestore
     */
    async syncTransactionsToFirestore(uid, bankCode, accountId, days = 30) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const transactions = await this.fetchTransactions(uid, bankCode, accountId, startDate, endDate);
        const batch = db.batch();
        let count = 0;
        for (const tx of transactions) {
            const docRef = db.doc(`users/${uid}/butler/finance/transactions/${tx.transactionId}`);
            const transaction = {
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
    async getAllBalances(uid) {
        const balances = [];
        for (const bankCode of Object.keys(finance_service_1.TAIWAN_BANKS)) {
            try {
                const connection = await this.getConnection(uid, bankCode);
                if (!connection)
                    continue;
                const accounts = await this.fetchAccounts(uid, bankCode);
                const bank = finance_service_1.TAIWAN_BANKS[bankCode];
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
            }
            catch (error) {
                console.error(`Failed to fetch balance for ${bankCode}:`, error);
            }
        }
        return balances;
    }
}
exports.TaiwanOpenBankingAdapter = TaiwanOpenBankingAdapter;
exports.openBankingAdapter = new TaiwanOpenBankingAdapter();
//# sourceMappingURL=open-banking.adapter.js.map