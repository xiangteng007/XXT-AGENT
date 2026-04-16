/**
 * seed-factory.ts — D-1: 測試資料工廠
 *
 * 提供型別安全的測試資料產生函數。
 * 所有 factory 回傳的資料皆符合 @xxt-agent/types 型別定義。
 */

import * as crypto from 'crypto';

// ════════════════════════════════════════════════════════════════
// Ledger Entries（帳本記錄）
// ════════════════════════════════════════════════════════════════

export function createLedgerEntry(overrides: Record<string, unknown> = {}) {
  return {
    entry_id: crypto.randomUUID(),
    company_id: 'senteng-test',
    entity_type: 'co_senteng',
    type: 'expense',
    category: 'other_expense',
    description: '土地銀行房貸月繳',
    amount_untaxed: 15000,
    tax_amount: 0,
    amount_taxed: 15000,
    tax_rate: 0,
    is_tax_exempt: true,
    counterparty_name: '土地銀行',
    payment_method: 'bank_transfer',
    transaction_date: '2026-04-01',
    period: '202604',
    created_at: new Date().toISOString(),
    created_by: 'e2e-test',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════
// Loan Records（貸款記錄）
// ════════════════════════════════════════════════════════════════

export function createLoanRecord(overrides: Record<string, unknown> = {}) {
  return {
    loan_id: crypto.randomUUID(),
    entity_type: 'co_senteng',
    category: 'mortgage',
    bank: '土地銀行',
    loan_name: '營業用房屋貸款',
    principal: 5000000,
    outstanding_balance: 3500000,
    annual_rate: 2.1,
    loan_months: 240,
    remaining_months: 180,
    monthly_payment: 15000,
    repayment_method: 'equal_payment',
    start_date: '2020-01-01',
    end_date: '2040-01-01',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ledger_linked: true,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════
// Write Request（跨 Agent 寫入請求）
// ════════════════════════════════════════════════════════════════

export function createWriteRequestParams(overrides: Record<string, unknown> = {}) {
  return {
    source_agent: 'scout',
    target_agent: 'lex',
    collection: 'contracts',
    operation: 'create' as const,
    data: {
      title: 'E2E 測試合約',
      counterparty: '測試廠商',
      total_amount: 500000,
    },
    idempotency_key: `e2e-test-${crypto.randomUUID()}`,
    reason: 'E2E 測試：Scout 發起 UAV 合約請求',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════
// Events（事件）
// ════════════════════════════════════════════════════════════════

export function createEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'TASK_QUEUED',
    source: 'e2e-test',
    payload: { message: 'E2E test event' },
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════
// Chat Messages（對話訊息）
// ════════════════════════════════════════════════════════════════

export function createChatMessage(overrides: Record<string, unknown> = {}) {
  return {
    message: '請問這個月的帳本有什麼問題？',
    session_id: `e2e-session-${crypto.randomUUID()}`,
    user_id: 'e2e-test-user',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════
// Matched Reconciliation Data（配對的對帳資料）
// ════════════════════════════════════════════════════════════════

/**
 * 產生一組帳本 + 貸款配對資料（金額一致，應為 MATCHED）。
 */
export function createMatchedReconciliationPair() {
  return {
    ledgerEntry: createLedgerEntry({
      description: '玉山銀行房貸月繳',
      counterparty_name: '玉山銀行',
      amount_taxed: 25000,
    }),
    loanRecord: createLoanRecord({
      bank: '玉山銀行',
      loan_name: '住宅房屋貸款',
      monthly_payment: 25000,
    }),
  };
}

/**
 * 產生一組金額不一致的對帳資料（應為 AMOUNT_MISMATCH）。
 */
export function createMismatchedReconciliationPair() {
  return {
    ledgerEntry: createLedgerEntry({
      description: '第一銀行信貸月繳',
      counterparty_name: '第一銀行',
      amount_taxed: 8500,  // 帳本金額
    }),
    loanRecord: createLoanRecord({
      bank: '第一銀行',
      category: 'personal_loan',
      loan_name: '個人信貸',
      monthly_payment: 9200,  // 貸款金額（差 NT$700，超過容差 NT$100）
    }),
  };
}
