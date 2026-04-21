/**
 * Ledger Store — 鳴鑫帳本引擎
 *
 * 收支記錄持久化核心，使用 Firestore（fallback: in-memory）
 *
 * Firestore Collections:
 *   accountant_ledger/{entry_id}    — 每筆收支紀錄
 *   accountant_periods/{yyyyMM}     — 期間彙總快取（加速報表）
 *
 * 設計原則：
 *   - 所有金額以「整數新台幣元」儲存（避免浮點誤差）
 *   - 每筆記錄含稅前/稅後/稅額三欄，直接支援申報
 *   - 支援多帳目類別 (category)，對應台灣記帳科目習慣
 */

import { logger } from './logger';
import type { EntityType } from './entity';
export type { EntityType } from './entity';

// ── 型別定義 ─────────────────────────────────────────────────

export type EntryType = 'income' | 'expense';

/** 收支類別（台灣工程公司常用科目 + 個人/家庭） */
export type IncomeCategory =
  // 公司 (company)
  | 'engineering_payment'     // 工程款（請款）
  | 'advance_payment'         // 工程預付款
  | 'design_fee'              // 設計費
  | 'consulting_fee'          // 顧問費
  | 'material_rebate'         // 材料退佣
  | 'other_income'            // 其他收入
  // 個人 (personal)
  | 'salary'                  // 薪資所得
  | 'freelance'               // 自由業（執行業務所得）
  | 'rental_income'           // 租金收入
  | 'investment_gain'         // 投資收益（股利、資本利得）
  // 家庭 (family)
  | 'allowance';              // 家用撥款

export type ExpenseCategory =
  // 公司 (company)
  | 'material'                // 材料費
  | 'labor'                   // 人工費
  | 'subcontract'             // 外包/分包款
  | 'equipment'               // 機具設備
  | 'overhead'                // 管銷費用
  | 'insurance'               // 保險費（工程保險/員工保險）
  | 'tax_payment'             // 稅款繳納
  | 'utilities'               // 水電費
  | 'rent'                    // 租金（公司廠辦）
  | 'office_supply'           // 辦公用品
  | 'entertainment'           // 交際費
  | 'transportation'          // 交通費
  | 'professional_service'    // 會計/法律等專業服務費
  | 'other_expense'           // 其他支出
  // 家庭支出（可申報綜所稅扣除額）
  | 'medical'                 // 醫療費（每人上限 NT$200,000）
  | 'education'               // 子女教育費（每人 NT$25,000）
  | 'life_insurance'          // 壽險費（每人 NT$24,000）
  | 'house_rent'              // 租屋費（NT$120,000）
  | 'family_living';          // 一般家庭生活費

export type LedgerCategory = IncomeCategory | ExpenseCategory;

/** 發票資訊（選填） */
export interface InvoiceRef {
  invoice_no: string;           // 發票號碼（e.g. AB12345678）
  invoice_type: 'two_copy' | 'three_copy' | 'electronic' | 'receipt';
  buyer_name?: string;          // 買受人（三聯式）
  buyer_tax_id?: string;        // 買受人統一編號
}

/** 單筆收支紀錄 */
export interface LedgerEntry {
  // 識別
  entry_id: string;             // UUID
  company_id: string;           // 公司識別（多租戶預留）
  project_id?: string;          // 關聯工程專案

  // 實體分類（Phase 2 新增，預設 'company'）
  entity_type?: EntityType;     // v6.0: 7 實體 (personal|family|co_drone|co_construction|co_renovation|co_design|assoc_rescue)

  // 分類
  type: EntryType;
  category: LedgerCategory;
  description: string;          // 摘要說明

  // 金額（整數新台幣元）
  amount_untaxed: number;       // 未稅金額
  tax_amount: number;           // 稅額
  amount_taxed: number;         // 含稅金額（= untaxed + tax）
  tax_rate: number;             // 稅率（百分比，e.g. 5）
  is_tax_exempt: boolean;       // 是否免稅/零稅率

  // 發票
  invoice?: InvoiceRef;

  // 對象
  counterparty_name?: string;   // 廠商/客戶名稱
  counterparty_tax_id?: string; // 廠商/客戶統一編號

  // 付款方式（Phase 2 新增）
  payment_method?: 'bank_transfer' | 'cash' | 'check' | 'credit_card' | 'other';

  // 銀行帳戶關聯（Phase 2 新增，從銀行交易同步時填入）
  bank_account_id?: string;     // 來源/目標銀行帳戶 ID
  bank_txn_id?: string;         // 關聯銀行交易 ID

  // 時間
  transaction_date: string;     // 交易日期（YYYY-MM-DD）
  period: string;               // 申報期間（YYYYMM）
  created_at: string;           // 記錄建立時間（ISO）
  created_by?: string;          // 建立者（user_id 或 'accountant-bot'）

  // 稽核
  is_deductible?: boolean;      // 是否可進項扣抵（支出類）
  notes?: string;               // 備註
}

/** 期間彙總 */
export interface PeriodSummary {
  period: string;               // YYYYMM
  period_label: string;         // e.g. "2026年3-4月（第2期）"
  total_income_taxed: number;
  total_income_untaxed: number;
  total_expense_taxed: number;
  total_expense_untaxed: number;
  total_tax_output: number;     // 銷項稅額（收入税）
  total_tax_input: number;      // 進項稅額（支出税，可扣抵）
  net_tax_payable: number;      // 應繳/退稅 (output - input)
  net_profit_loss: number;      // 損益（收入-支出，未稅）
  entry_count: number;
  income_by_category: Partial<Record<IncomeCategory, number>>;
  expense_by_category: Partial<Record<ExpenseCategory, number>>;
}

// ── In-memory Fallback ────────────────────────────────────────
const IN_MEMORY_LEDGER: LedgerEntry[] = [];
const LEDGER_MAX = 5000;

// ── Firestore 連線（從單例取得）───────────────────────────────
import { getDb as getFirestoreDb } from './firestore-client';

let _db: FirebaseFirestore.Firestore | null = null;

function getDb(): FirebaseFirestore.Firestore | null {
  if (_db) return _db;
  _db = getFirestoreDb();
  return _db;
}

// ── 工具函數 ─────────────────────────────────────────────────

/** 由交易日期推算台灣營業稅申報期間（YYYYMM 格式，取奇數月） */
export function calcPeriod(transactionDate: string): string {
  const d = new Date(transactionDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  // 台灣 2 個月一期：1-2月→01, 3-4月→03, 5-6月→05 ...
  const periodMonth = month % 2 === 1 ? month : month - 1;
  return `${year}${String(periodMonth).padStart(2, '0')}`;
}

/** 產生期間中文標籤 */
export function periodLabel(period: string): string {
  const year = parseInt(period.slice(0, 4));
  const m1 = parseInt(period.slice(4, 6));
  const m2 = m1 + 1;
  const periodNum = Math.ceil(m1 / 2);
  return `${year}年${m1}-${m2}月（第${periodNum}期）`;
}

// ── 核心 CRUD ────────────────────────────────────────────────

/**
 * 新增一筆收支記錄
 */
export async function addEntry(entry: LedgerEntry): Promise<{ ok: boolean; entry_id: string }> {
  const db = await getDb();

  if (!db) {
    if (IN_MEMORY_LEDGER.length >= LEDGER_MAX) IN_MEMORY_LEDGER.shift();
    IN_MEMORY_LEDGER.push(entry);
    logger.info(`[Ledger] Saved in-memory: ${entry.entry_id} | ${entry.type} | NT$${entry.amount_taxed}`);
    return { ok: true, entry_id: entry.entry_id };
  }

  try {
    await db.collection('accountant_ledger').doc(entry.entry_id).set(entry);
    logger.info(`[Ledger] Saved to Firestore: ${entry.entry_id}`);
    return { ok: true, entry_id: entry.entry_id };
  } catch (err) {
    // Firestore 失敗 → fallback in-memory
    IN_MEMORY_LEDGER.push(entry);
    logger.warn(`[Ledger] Firestore failed, buffered: ${String(err)}`);
    return { ok: true, entry_id: entry.entry_id };
  }
}

/**
 * 刪除一筆收支記錄 (補償機制用)
 */
export async function deleteEntry(entry_id: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    const idx = IN_MEMORY_LEDGER.findIndex(e => e.entry_id === entry_id);
    if (idx >= 0) IN_MEMORY_LEDGER.splice(idx, 1);
    logger.info(`[Ledger] Deleted in-memory: ${entry_id}`);
    return;
  }
  try {
    await db.collection('accountant_ledger').doc(entry_id).delete();
    logger.info(`[Ledger] Deleted from Firestore: ${entry_id}`);
  } catch (err) {
    logger.warn(`[Ledger] Failed to delete from Firestore: ${String(err)}`);
    throw err;
  }
}

/**
 * 查詢收支記錄
 * @param filters.type  income|expense|all
 * @param filters.period  YYYYMM
 * @param filters.project_id 工程專案
 * @param filters.limit 筆數上限
 */
export async function queryEntries(filters: {
  type?: EntryType | 'all';
  period?: string;
  project_id?: string;
  category?: LedgerCategory;
  company_id?: string;
  entity_type?: EntityType;
  date_from?: string;
  date_to?: string;
  year?: number;
  limit?: number;
}): Promise<LedgerEntry[]> {
  const db = await getDb();
  const limit = filters.limit ?? 100;

  // year → date range
  let date_from = filters.date_from;
  let date_to = filters.date_to;
  if (filters.year) {
    date_from = date_from ?? `${filters.year}-01-01`;
    date_to   = date_to   ?? `${filters.year}-12-31`;
  }

  if (!db) {
    // In-memory 過濾
    return IN_MEMORY_LEDGER
      .filter(e => {
        if (filters.type && filters.type !== 'all' && e.type !== filters.type) return false;
        if (filters.period && e.period !== filters.period) return false;
        if (filters.project_id && e.project_id !== filters.project_id) return false;
        if (filters.category && e.category !== filters.category) return false;
        if (filters.entity_type && (e.entity_type ?? 'company') !== filters.entity_type) return false;
        if (date_from && e.transaction_date < date_from) return false;
        if (date_to && e.transaction_date > date_to) return false;
        return true;
      })
      .slice(-limit)
      .reverse();
  }

  try {
    let query: FirebaseFirestore.Query = db.collection('accountant_ledger');
    if (filters.type && filters.type !== 'all') query = query.where('type', '==', filters.type);
    if (filters.period) query = query.where('period', '==', filters.period);
    if (filters.project_id) query = query.where('project_id', '==', filters.project_id);
    if (filters.category) query = query.where('category', '==', filters.category);
    if (filters.entity_type) query = query.where('entity_type', '==', filters.entity_type);
    if (date_from) query = query.where('transaction_date', '>=', date_from);
    if (date_to)   query = query.where('transaction_date', '<=', date_to);

    const snap = await query.orderBy('transaction_date', 'desc').limit(limit).get();
    return snap.docs.map(d => d.data() as LedgerEntry);
  } catch {
    return IN_MEMORY_LEDGER.slice(-limit).reverse();
  }
}

/**
 * 計算期間彙總（報表核心）
 */
export async function calcPeriodSummary(period: string): Promise<PeriodSummary> {
  const entries = await queryEntries({ period, limit: 5000 });

  const income  = entries.filter(e => e.type === 'income');
  const expense = entries.filter(e => e.type === 'expense');

  const sumField = (arr: LedgerEntry[], f: keyof LedgerEntry) =>
    arr.reduce((s, e) => s + ((e[f] as number) || 0), 0);

  const income_by_category: Partial<Record<IncomeCategory, number>> = {};
  for (const e of income) {
    const cat = e.category as IncomeCategory;
    income_by_category[cat] = (income_by_category[cat] ?? 0) + e.amount_untaxed;
  }

  const expense_by_category: Partial<Record<ExpenseCategory, number>> = {};
  for (const e of expense) {
    const cat = e.category as ExpenseCategory;
    expense_by_category[cat] = (expense_by_category[cat] ?? 0) + e.amount_untaxed;
  }

  const total_income_untaxed  = sumField(income, 'amount_untaxed');
  const total_income_taxed    = sumField(income, 'amount_taxed');
  const total_expense_untaxed = sumField(expense, 'amount_untaxed');
  const total_expense_taxed   = sumField(expense, 'amount_taxed');
  const total_tax_output      = sumField(income, 'tax_amount');
  const total_tax_input       = sumField(expense.filter(e => e.is_deductible !== false), 'tax_amount');

  return {
    period,
    period_label: periodLabel(period),
    total_income_taxed,
    total_income_untaxed,
    total_expense_taxed,
    total_expense_untaxed,
    total_tax_output,
    total_tax_input,
    net_tax_payable: total_tax_output - total_tax_input,
    net_profit_loss: total_income_untaxed - total_expense_untaxed,
    entry_count: entries.length,
    income_by_category,
    expense_by_category,
  };
}

/**
 * 計算年度彙總（6 期合計）
 */
export async function calcYearSummary(year: number): Promise<{
  year: number;
  periods: PeriodSummary[];
  annual: Omit<PeriodSummary, 'period' | 'period_label'>;
}> {
  const periods: PeriodSummary[] = [];
  for (let m = 1; m <= 11; m += 2) {
    const period = `${year}${String(m).padStart(2, '0')}`;
    periods.push(await calcPeriodSummary(period));
  }

  const sum = (f: keyof PeriodSummary) =>
    periods.reduce((s, p) => s + ((p[f] as number) || 0), 0);

  return {
    year,
    periods,
    annual: {
      total_income_taxed:      sum('total_income_taxed'),
      total_income_untaxed:    sum('total_income_untaxed'),
      total_expense_taxed:     sum('total_expense_taxed'),
      total_expense_untaxed:   sum('total_expense_untaxed'),
      total_tax_output:        sum('total_tax_output'),
      total_tax_input:         sum('total_tax_input'),
      net_tax_payable:         sum('net_tax_payable'),
      net_profit_loss:         sum('net_profit_loss'),
      entry_count:             sum('entry_count'),
      income_by_category:      {},
      expense_by_category:     {},
    },
  };
}

// ── 文件生成器 ───────────────────────────────────────────────

/**
 * 產生 401 申報書（台灣營業稅一般申報書）格式
 * 符合財政部 401 表格欄位結構，可直接核對後送申
 */
export function generate401Report(summary: PeriodSummary, companyName: string, taxId: string): object {
  const [year, m1] = [
    parseInt(summary.period.slice(0, 4)) - 1911,  // 民國年
    parseInt(summary.period.slice(4, 6)),
  ];
  const m2 = m1 + 1;

  return {
    form_type: '401',
    title: '營業稅申報書（一般）',
    _note: '※ 本表由 鳴鑫會計師 AI 自動生成，申報前請核對並由負責人簽章',
    header: {
      company_name: companyName,
      tax_id: taxId,
      tax_period: `${year}年${m1}～${m2}月`,
      filing_deadline: `${year + 1911}/${String(m2 + 1).padStart(2, '0')}/15`,  // 次期開始後15日
    },
    section_1_sales: {
      label: '壹、銷售額計算',
      taxable_sales_standard: summary.total_income_untaxed,
      tax_output: summary.total_tax_output,
      zero_rate_sales: 0,
      exempt_sales: 0,
      total_sales: summary.total_income_untaxed,
    },
    section_2_purchases: {
      label: '貳、進項稅額計算',
      taxable_purchases: summary.total_expense_untaxed,
      tax_input: summary.total_tax_input,
      non_deductible: 0,
      deductible_tax: summary.total_tax_input,
    },
    section_3_tax_calculation: {
      label: '參、應納（退）稅額',
      output_tax: summary.total_tax_output,
      deductible_input_tax: summary.total_tax_input,
      net_tax_payable: Math.max(summary.net_tax_payable, 0),
      refund_amount: Math.max(-summary.net_tax_payable, 0),
    },
    income_breakdown: summary.income_by_category,
    expense_breakdown: summary.expense_by_category,
    generated_at: new Date().toISOString(),
    period_summary: {
      total_entries: summary.entry_count,
      net_profit_loss: summary.net_profit_loss,
    },
  };
}

/**
 * 產生收支明細表（CSV 格式字串，可直接儲存）
 */
export async function generateLedgerCsv(period?: string, year?: number): Promise<string> {
  const filters: Parameters<typeof queryEntries>[0] = { limit: 5000 };
  if (period) filters.period = period;
  if (year) {
    filters.date_from = `${year}-01-01`;
    filters.date_to   = `${year}-12-31`;
  }

  const entries = await queryEntries(filters);

  const headers = [
    '交易日期', '申報期間', '類型', '科目', '摘要說明',
    '未稅金額', '稅額', '含稅金額', '稅率', '免稅',
    '發票號碼', '發票種類', '對象名稱', '統一編號',
    '工程專案', '可扣抵', '備註', '建立時間'
  ].join(',');

  const rows = entries.map(e => [
    e.transaction_date,
    e.period,
    e.type === 'income' ? '收入' : '支出',
    e.category,
    `"${e.description.replace(/"/g, '""')}"`,
    e.amount_untaxed,
    e.tax_amount,
    e.amount_taxed,
    `${e.tax_rate}%`,
    e.is_tax_exempt ? '是' : '否',
    e.invoice?.invoice_no ?? '',
    e.invoice?.invoice_type ?? '',
    `"${(e.counterparty_name ?? '').replace(/"/g, '""')}"`,
    e.counterparty_tax_id ?? '',
    e.project_id ?? '',
    e.is_deductible === false ? '否' : '是',
    `"${(e.notes ?? '').replace(/"/g, '""')}"`,
    e.created_at,
  ].join(','));

  return [headers, ...rows].join('\n');
}

export { IN_MEMORY_LEDGER };
