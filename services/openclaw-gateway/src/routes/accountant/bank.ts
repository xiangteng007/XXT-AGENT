/**
 * Accountant — Bank Sub-router (A-3 / CR-02)
 *
 * POST /agents/accountant/bank/account  — 新增銀行帳戶
 * GET  /agents/accountant/bank/accounts — 查詢帳戶列表
 * GET  /agents/accountant/bank/balance  — 餘額彙總
 * POST /agents/accountant/bank/txn      — 記錄銀行往來（雙寫帳本）
 * GET  /agents/accountant/bank/txn      — 查詢銀行往來
 *
 * 拆分自 routes/accountant.ts（原 L642-L793）
 */

import * as crypto from 'crypto';
import { Router, Request, Response } from 'express';
import {
  addBankAccount, getBankAccounts, getBankAccountByMasked, getBankBalanceSummary,
  addBankTransaction, queryBankTransactions, linkTxnToEntry, updateBankAccountBalance,
  maskAccountNo, entityLabel,
  type BankAccount, type BankTransaction,
} from '../../bank-store';
import {
  addEntry, calcPeriod,
  type LedgerEntry, type LedgerCategory, type EntryType, type EntityType,
} from '../../ledger-store';

export const bankRouter = Router();

const validEntities: EntityType[] = ['personal', 'family', 'co_drone', 'co_construction', 'co_renovation', 'co_design', 'assoc_rescue'];

// ── POST /bank/account ── 新增銀行帳戶 ───────────────────────
bankRouter.post('/bank/account', async (req: Request, res: Response) => {
  const b = req.body as {
    bank_name?: string; bank_code?: string; account_no?: string;
    account_holder?: string; entity_type?: string; currency?: string;
    current_balance?: number; notes?: string;
  };
  if (!b.bank_name || !b.account_no || !b.account_holder) {
    res.status(400).json({ error: 'bank_name, account_no, account_holder required' }); return;
  }
  const entity: EntityType = validEntities.includes(b.entity_type as EntityType) ? b.entity_type as EntityType : 'co_construction';
  const account: BankAccount = {
    account_id: crypto.randomUUID(), company_id: 'default', entity_type: entity,
    bank_name: b.bank_name, bank_code: b.bank_code ?? '',
    account_no_masked: maskAccountNo(b.account_no), account_no_full: b.account_no,
    account_holder: b.account_holder, currency: b.currency === 'USD' ? 'USD' : 'TWD',
    current_balance: b.current_balance ?? 0, is_active: true,
    created_at: new Date().toISOString(), notes: b.notes,
  };
  const result = await addBankAccount(account);
  res.status(201).json({
    ok: result.ok, account_id: result.account_id,
    summary: { bank_name: account.bank_name, account_no_masked: account.account_no_masked, account_holder: account.account_holder, entity_type: account.entity_type, entity_label: entityLabel(entity), currency: account.currency, current_balance: account.current_balance },
    message: `${entityLabel(entity)}帳戶「${account.bank_name} ${account.account_no_masked}」已新增`,
  });
});

// ── GET /bank/accounts ── 查詢帳戶列表 ──────────────────────
bankRouter.get('/bank/accounts', async (req: Request, res: Response) => {
  const { entity_type, active_only } = req.query as { entity_type?: string; active_only?: string };
  const entity = validEntities.includes(entity_type as EntityType) ? entity_type as EntityType : undefined;
  const accounts = await getBankAccounts({ entity_type: entity, active_only: active_only !== 'false' });
  const safe = accounts.map(a => ({
    account_id: a.account_id, entity_type: a.entity_type, entity_label: entityLabel(a.entity_type),
    bank_name: a.bank_name, bank_code: a.bank_code, account_no_masked: a.account_no_masked,
    account_holder: a.account_holder, currency: a.currency, current_balance: a.current_balance,
    is_active: a.is_active, notes: a.notes,
  }));
  res.json({ count: safe.length, accounts: safe });
});

// ── GET /bank/balance ── 餘額彙總 ────────────────────────────
bankRouter.get('/bank/balance', async (_req: Request, res: Response) => {
  const summaries = await getBankBalanceSummary();
  const grand_total = summaries.reduce((s, x) => s + x.total_balance_twd, 0);
  res.json({
    generated_at: new Date().toISOString(), grand_total_twd: grand_total,
    by_entity: summaries.map(s => ({ entity_type: s.entity_type, entity_label: entityLabel(s.entity_type), account_count: s.accounts.length, total_balance: s.total_balance_twd, accounts: s.accounts })),
  });
});

// ── POST /bank/txn ── 記錄銀行往來（雙寫帳本）──────────────
bankRouter.post('/bank/txn', async (req: Request, res: Response) => {
  const b = req.body as {
    account_no_masked?: string; account_id?: string; type?: string; amount?: number;
    txn_date?: string; description?: string; counterparty?: string;
    reference_no?: string; balance_after?: number; ledger_category?: string; payment_method?: string;
  };
  if (!b.type || !b.amount || !b.description) { res.status(400).json({ error: 'type, amount, description required' }); return; }
  if (b.type !== 'credit' && b.type !== 'debit') { res.status(400).json({ error: 'type must be credit or debit' }); return; }

  let account = null;
  if (b.account_id) { const all = await getBankAccounts({ active_only: true }); account = all.find(a => a.account_id === b.account_id) ?? null; }
  else if (b.account_no_masked) { account = await getBankAccountByMasked(b.account_no_masked); }
  if (!account) { res.status(404).json({ error: 'Bank account not found. Use GET /bank/accounts to list.' }); return; }

  const txnDate = b.txn_date ?? new Date().toISOString().slice(0, 10);
  const txn: BankTransaction = {
    txn_id: crypto.randomUUID(), account_id: account.account_id, entity_type: account.entity_type,
    type: b.type as 'credit' | 'debit', amount: Math.round(b.amount), balance_after: b.balance_after,
    txn_date: txnDate, description: b.description, counterparty: b.counterparty,
    reference_no: b.reference_no, ledger_category: b.ledger_category,
    payment_method: b.payment_method, created_at: new Date().toISOString(), created_by: 'accountant-bot',
  };
  const txnResult = await addBankTransaction(txn);
  if (b.balance_after !== undefined) await updateBankAccountBalance(account.account_id, b.balance_after);

  let linked_entry_id: string | null = null;
  if (b.ledger_category) {
    const entryType: EntryType = b.type === 'credit' ? 'income' : 'expense';
    const isTaxExempt = ['salary', 'allowance', 'family_living', 'investment_gain'].includes(b.ledger_category);
    const taxRate = isTaxExempt ? 0 : 5;
    const amountUntaxed = isTaxExempt ? Math.round(b.amount) : Math.round(b.amount / 1.05);
    const entry: LedgerEntry = {
      entry_id: crypto.randomUUID(), company_id: 'default', entity_type: account.entity_type,
      type: entryType, category: b.ledger_category as LedgerCategory,
      description: b.description, amount_untaxed: amountUntaxed,
      tax_amount: Math.round(b.amount) - amountUntaxed, amount_taxed: Math.round(b.amount),
      tax_rate: taxRate, is_tax_exempt: isTaxExempt, counterparty_name: b.counterparty,
      payment_method: 'bank_transfer', bank_account_id: account.account_id, bank_txn_id: txn.txn_id,
      transaction_date: txnDate, period: calcPeriod(txnDate),
      created_at: new Date().toISOString(), created_by: 'accountant-bot',
    };
    const entryResult = await addEntry(entry);
    linked_entry_id = entryResult.entry_id;
    await linkTxnToEntry(txn.txn_id, linked_entry_id);
  }
  res.status(201).json({
    ok: true, txn_id: txnResult.txn_id, linked_entry_id, dual_write: linked_entry_id !== null,
    summary: { bank: `${account.bank_name} ${account.account_no_masked}`, entity: entityLabel(account.entity_type), type: b.type === 'credit' ? '存入（收入）' : '提出（支出）', amount: Math.round(b.amount), txn_date: txnDate, description: b.description, ledger_synced: linked_entry_id !== null },
  });
});

// ── GET /bank/txn ── 查詢銀行往來 ────────────────────────────
bankRouter.get('/bank/txn', async (req: Request, res: Response) => {
  const { account_no_masked, account_id, entity_type, period, type, limit } = req.query as Record<string, string | undefined>;
  let resolvedAccountId = account_id;
  if (!resolvedAccountId && account_no_masked) { const acct = await getBankAccountByMasked(account_no_masked); resolvedAccountId = acct?.account_id; }
  const entity = validEntities.includes(entity_type as EntityType) ? entity_type as EntityType : undefined;
  const txns = await queryBankTransactions({ account_id: resolvedAccountId, entity_type: entity, period, type: (type === 'credit' || type === 'debit') ? type : undefined, limit: limit ? parseInt(limit) : 30 });
  const totalCredit = txns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalDebit = txns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
  res.json({
    count: txns.length, total_credit: totalCredit, total_debit: totalDebit, net: totalCredit - totalDebit,
    transactions: txns.map(t => ({ txn_id: t.txn_id, entity_type: t.entity_type, entity_label: entityLabel(t.entity_type), type: t.type, type_label: t.type === 'credit' ? '存入' : '提出', amount: t.amount, balance_after: t.balance_after, txn_date: t.txn_date, description: t.description, counterparty: t.counterparty, ledger_category: t.ledger_category, linked_entry_id: t.linked_entry_id })),
  });
});
