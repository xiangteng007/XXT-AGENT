/**
 * Bank Store — 鳴鑫銀行帳戶引擎
 *
 * 管理銀行帳戶主檔與往來交易記錄
 * Firestore Collections:
 *   bank_accounts/{account_id}     — 帳戶主檔
 *   bank_transactions/{txn_id}     — 往來交易
 *
 * 設計原則：
 *   - 帳號儲存完整（PRIVATE路由，財務資料不出境）
 *   - 顯示時一律用後四碼遮罩
 *   - 余額以最後填寫為準（非自動累計，避免誤差）
 *   - 支援 7 實體：v6.0 EntityType（entity.ts 單一來源）
 */

import { logger } from './logger';
import { type EntityType, entityLabel as _entityLabel, ALL_ENTITIES } from './entity';

// ── 型別 re-export（向後相容，其他模組可繼續 import from bank-store）──
export type { EntityType } from './entity';

// ── 型別定義 ─────────────────────────────────────────────────────

export type BankCurrency = 'TWD' | 'USD' | 'other';
export type TxnType = 'credit' | 'debit';

export interface BankAccount {
  account_id: string;           // UUID
  company_id: string;           // 多租戶預留
  entity_type: EntityType;      // 所屬實體
  bank_name: string;            // 銀行名稱（台灣銀行、合作金庫...）
  bank_code: string;            // 金融機構代碼（004=台銀，006=合庫...）
  account_no_masked: string;    // 後四碼（顯示用）
  account_no_full: string;      // 完整帳號（PRIVATE，不對外顯示）
  account_holder: string;       // 戶名
  currency: BankCurrency;
  current_balance: number;      // 最後已知餘額（整數 TWD）
  is_active: boolean;
  created_at: string;           // ISO
  notes?: string;
}

export interface BankTransaction {
  txn_id: string;               // UUID
  account_id: string;           // 對應銀行帳戶
  entity_type: EntityType;      // 冗餘儲存，加速查詢
  type: TxnType;                // credit=存入, debit=提出
  amount: number;               // 整數 TWD
  balance_after?: number;       // 交易後餘額（選填）
  txn_date: string;             // YYYY-MM-DD
  description: string;          // 摘要
  counterparty?: string;        // 對方戶名
  reference_no?: string;        // 交易序號/支票號碼
  linked_entry_id?: string;     // 關聯 LedgerEntry ID
  ledger_category?: string;     // 對應帳本科目
  payment_method?: string;      // 'bank_transfer' | 'check' | 'cash'
  created_at: string;
  created_by?: string;
}

export interface BankBalanceSummary {
  entity_type: EntityType;
  accounts: Array<{
    account_id: string;
    bank_name: string;
    account_no_masked: string;
    account_holder: string;
    currency: BankCurrency;
    current_balance: number;
    is_active: boolean;
  }>;
  total_balance_twd: number;
}

// ── In-memory Fallback ────────────────────────────────────────────
const IN_MEMORY_ACCOUNTS: BankAccount[] = [];
const IN_MEMORY_TXNS: BankTransaction[] = [];
const TXN_MAX = 2000;

// ── Firestore 連線（從單例取得）───────────────────────────────────
import { getDb as getFirestoreDb } from './firestore-client';

let _db: FirebaseFirestore.Firestore | null = null;

function getDb(): FirebaseFirestore.Firestore | null {
  if (_db) return _db;
  _db = getFirestoreDb();
  return _db;
}

// ── 工具函數 ──────────────────────────────────────────────────────

/** 帳號遮罩（輸出後四碼） */
export function maskAccountNo(full: string): string {
  if (full.length <= 4) return full;
  return `${'*'.repeat(full.length - 4)}${full.slice(-4)}`;
}

/** 實體中文標示（委派至 entity.ts）*/
export function entityLabel(e: EntityType): string {
  return _entityLabel(e);
}

// ── BankAccount CRUD ───────────────────────────────────────────────

export async function addBankAccount(
  account: BankAccount,
): Promise<{ ok: boolean; account_id: string }> {
  const db = await getDb();

  if (!db) {
    IN_MEMORY_ACCOUNTS.push(account);
    logger.info(`[Bank] Saved in-memory account: ${account.account_id}`);
    return { ok: true, account_id: account.account_id };
  }

  try {
    await db.collection('bank_accounts').doc(account.account_id).set(account);
    logger.info(`[Bank] Account saved to Firestore: ${account.account_id}`);
    return { ok: true, account_id: account.account_id };
  } catch (err) {
    IN_MEMORY_ACCOUNTS.push(account);
    logger.warn(`[Bank] Firestore failed (account), buffered: ${String(err)}`);
    return { ok: true, account_id: account.account_id };
  }
}

export async function getBankAccounts(filters: {
  company_id?: string;
  entity_type?: EntityType;
  active_only?: boolean;
}): Promise<BankAccount[]> {
  const db = await getDb();

  if (!db) {
    return IN_MEMORY_ACCOUNTS.filter(a => {
      if (filters.entity_type && a.entity_type !== filters.entity_type) return false;
      if (filters.active_only && !a.is_active) return false;
      return true;
    });
  }

  try {
    let q: FirebaseFirestore.Query = db.collection('bank_accounts');
    if (filters.entity_type) q = q.where('entity_type', '==', filters.entity_type);
    if (filters.active_only) q = q.where('is_active', '==', true);
    const snap = await q.orderBy('created_at', 'asc').get();
    return snap.docs.map(d => d.data() as BankAccount);
  } catch {
    return IN_MEMORY_ACCOUNTS;
  }
}

export async function getBankAccountByMasked(
  masked: string,
  entity_type?: EntityType,
): Promise<BankAccount | null> {
  const all = await getBankAccounts({ entity_type, active_only: true });
  return all.find(a => a.account_no_masked === masked) ?? null;
}

export async function updateBankAccountBalance(
  account_id: string,
  new_balance: number,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    const a = IN_MEMORY_ACCOUNTS.find(x => x.account_id === account_id);
    if (a) a.current_balance = new_balance;
    return;
  }
  try {
    await db.collection('bank_accounts').doc(account_id).update({
      current_balance: new_balance,
    });
  } catch (err) {
    logger.warn(`[Bank] Balance update failed: ${String(err)}`);
  }
}

// ── BankTransaction CRUD ───────────────────────────────────────────
/**
 * 新增一筆銀行交易
 */
export async function addBankTransaction(txn: BankTransaction): Promise<{ ok: boolean; txn_id: string }> {
  const db = await getDb();
  if (!db) {
    if (IN_MEMORY_TXNS.length >= TXN_MAX) IN_MEMORY_TXNS.shift();
    IN_MEMORY_TXNS.push(txn);
    logger.info(`[Bank] Saved in-memory txn: ${txn.txn_id}`);
    return { ok: true, txn_id: txn.txn_id };
  }

  try {
    await db.collection('bank_transactions').doc(txn.txn_id).set(txn);
    logger.info(`[Bank] Saved to Firestore txn: ${txn.txn_id}`);
    return { ok: true, txn_id: txn.txn_id };
  } catch (err) {
    IN_MEMORY_TXNS.push(txn);
    logger.warn(`[Bank] Firestore failed, buffered txn: ${String(err)}`);
    return { ok: true, txn_id: txn.txn_id };
  }
}

/**
 * 刪除一筆銀行交易記錄 (補償機制用)
 */
export async function deleteBankTransaction(txn_id: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    const idx = IN_MEMORY_TXNS.findIndex(t => t.txn_id === txn_id);
    if (idx >= 0) IN_MEMORY_TXNS.splice(idx, 1);
    logger.info(`[Bank] Deleted in-memory txn: ${txn_id}`);
    return;
  }
  try {
    await db.collection('bank_transactions').doc(txn_id).delete();
    logger.info(`[Bank] Deleted from Firestore: ${txn_id}`);
  } catch (err) {
    logger.warn(`[Bank] Failed to delete from Firestore: ${String(err)}`);
    throw err;
  }
}

/** 更新交易的 linked_entry_id（雙寫完成後回填） */
export async function linkTxnToEntry(
  txn_id: string,
  entry_id: string,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    const t = IN_MEMORY_TXNS.find(x => x.txn_id === txn_id);
    if (t) t.linked_entry_id = entry_id;
    return;
  }
  try {
    await db.collection('bank_transactions').doc(txn_id).update({ linked_entry_id: entry_id });
  } catch {
    // non-critical
  }
}

export async function queryBankTransactions(filters: {
  account_id?: string;
  entity_type?: EntityType;
  txn_date_from?: string;
  txn_date_to?: string;
  period?: string;   // YYYYMM → convert to date range
  type?: TxnType;
  counterparty?: string;
  limit?: number;
}): Promise<BankTransaction[]> {
  const db = await getDb();
  const limit = filters.limit ?? 50;

  // period → date range
  let date_from = filters.txn_date_from;
  let date_to = filters.txn_date_to;
  if (filters.period && /^\d{6}$/.test(filters.period)) {
    const y = filters.period.slice(0, 4);
    const m1 = parseInt(filters.period.slice(4, 6));
    const m2 = m1 + 1;
    date_from = `${y}-${String(m1).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(y), m2, 0).getDate();
    date_to = `${y}-${String(m2).padStart(2, '0')}-${lastDay}`;
  }

  if (!db) {
    return IN_MEMORY_TXNS
      .filter(t => {
        if (filters.account_id && t.account_id !== filters.account_id) return false;
        if (filters.entity_type && t.entity_type !== filters.entity_type) return false;
        if (filters.type && t.type !== filters.type) return false;
        if (date_from && t.txn_date < date_from) return false;
        if (date_to && t.txn_date > date_to) return false;
        if (filters.counterparty && !t.counterparty?.includes(filters.counterparty)) return false;
        return true;
      })
      .slice(-limit)
      .reverse();
  }

  try {
    let q: FirebaseFirestore.Query = db.collection('bank_transactions');
    if (filters.account_id) q = q.where('account_id', '==', filters.account_id);
    if (filters.entity_type) q = q.where('entity_type', '==', filters.entity_type);
    if (filters.type) q = q.where('type', '==', filters.type);
    if (date_from) q = q.where('txn_date', '>=', date_from);
    if (date_to)   q = q.where('txn_date', '<=', date_to);
    const snap = await q.orderBy('txn_date', 'desc').limit(limit * 2).get(); // fetch more to accommodate post-filtering
    let results = snap.docs.map(d => d.data() as BankTransaction);
    if (filters.counterparty) {
      results = results.filter(t => t.counterparty?.includes(filters.counterparty!));
    }
    return results.slice(0, limit);
  } catch {
    return IN_MEMORY_TXNS.slice(-limit).reverse();
  }
}

/**
 * 計算各實體銀行帳戶餘額彙總
 */
export async function getBankBalanceSummary(): Promise<BankBalanceSummary[]> {
  const accounts = await getBankAccounts({ active_only: true });
  const entities: EntityType[] = [...ALL_ENTITIES];

  return entities.map(entity => {
    const entityAccounts = accounts.filter(a => a.entity_type === entity);
    const total = entityAccounts.reduce((s, a) => s + a.current_balance, 0);
    return {
      entity_type: entity,
      accounts: entityAccounts.map(a => ({
        account_id: a.account_id,
        bank_name: a.bank_name,
        account_no_masked: a.account_no_masked,
        account_holder: a.account_holder,
        currency: a.currency,
        current_balance: a.current_balance,
        is_active: a.is_active,
      })),
      total_balance_twd: total,
    };
  });
}

export { IN_MEMORY_ACCOUNTS, IN_MEMORY_TXNS };
