/**
 * LoanStore — 貸款資料管理引擎
 *
 * 支援 7 實體（v6.0 EntityType）的貸款 CRUD
 * 持久化至 Firestore loan_records；本地 in-memory fallback
 * 包含：還款試算（等額本息/本金）、貸款比較、資金缺口分析
 */

import { logger } from './logger';
import { type EntityType, entityShortLabel, ALL_ENTITIES } from './entity';

// ── 型別 re-export ───────────────────────────────────────────────────
export type { EntityType } from './entity';

export type LoanCategory =
  // 工程公司
  | 'construction_working_capital'  // 工程周轉貸款
  | 'equipment_financing'           // 設備機具融資
  | 'performance_bond_financing'    // 保證金融資
  | 'accounts_receivable_factoring' // 應收帳款保理
  | 'business_credit_line'          // 企業信用額度
  | 'policy_loan_sme'               // 中小企業政策貸款
  | 'green_energy_loan'             // 綠能貸款（太陽能/節能設備）
  // 個人
  | 'mortgage'                      // 房屋貸款
  | 'second_mortgage'               // 二胎房貸
  | 'car_loan'                      // 汽車貸款
  | 'personal_credit_loan'          // 信用貸款（無擔保）
  | 'student_loan'                  // 就學貸款
  | 'renovation_loan'               // 裝修貸款
  | 'policy_loan_personal'          // 個人政策性貸款
  // 家庭
  | 'family_mortgage'               // 家庭房貸
  | 'home_equity_loan'              // 房屋增貸
  | 'vehicle_loan_family'           // 家庭車貸
  | 'other';

export type RepaymentMethod = 'equal_payment' | 'equal_principal' | 'interest_only' | 'balloon';
export type LoanStatus = 'active' | 'paid_off' | 'default' | 'applied' | 'pending';

export interface LoanRecord {
  loan_id: string;
  entity_type: EntityType;
  category: LoanCategory;
  bank: string;                    // 貸款銀行
  loan_name?: string;              // 貸款案名（工程貸款）
  principal: number;               // 貸款本金 (TWD)
  outstanding_balance: number;     // 目前剩餘本金 (TWD)
  annual_rate: number;             // 年利率 (%)
  loan_months: number;             // 貸款期數（月）
  remaining_months: number;        // 剩餘期數（月）
  monthly_payment: number;         // 月繳金額 (TWD)
  repayment_method: RepaymentMethod;
  start_date: string;              // YYYY-MM-DD
  end_date: string;                // YYYY-MM-DD
  status: LoanStatus;
  collateral?: string;             // 擔保品描述
  grace_period_months?: number;    // 寬限期（月）
  notes?: string;
  created_at: string;
  updated_at: string;
  ledger_linked: boolean;
  ledger_entry_id?: string;
}

// ── 中文對照 ────────────────────────────────────────────────────

export const LOAN_CATEGORY_ZH: Record<LoanCategory, string> = {
  construction_working_capital:  '工程周轉貸款',
  equipment_financing:           '設備機具融資',
  performance_bond_financing:    '保證金融資',
  accounts_receivable_factoring: '應收帳款保理',
  business_credit_line:          '企業信用額度',
  policy_loan_sme:               '中小企業政策性貸款',
  green_energy_loan:             '綠能設備貸款',
  mortgage:                      '房屋貸款',
  second_mortgage:               '二胎房貸',
  car_loan:                      '汽車貸款',
  personal_credit_loan:          '信用貸款',
  student_loan:                  '就學貸款',
  renovation_loan:               '裝修貸款',
  policy_loan_personal:          '個人政策性貸款',
  family_mortgage:               '家庭房貸',
  home_equity_loan:              '房屋增貸',
  vehicle_loan_family:           '家庭車貸',
  other:                         '其他貸款',
};

/** 實體中文標示（委派至 entity.ts entityShortLabel）*/
export function ENTITY_ZH_LABEL(e: EntityType): string {
  return entityShortLabel(e);
}

// 保留 ENTITY_ZH 供現有 finance.ts 等路由使用，但動態生成
export const ENTITY_ZH: Record<string, string> = Object.fromEntries(
  ALL_ENTITIES.map(e => [e, entityShortLabel(e)]),
);

export const REPAYMENT_ZH: Record<RepaymentMethod, string> = {
  equal_payment:    '等額本息',
  equal_principal:  '等額本金',
  interest_only:    '只繳息（寬限期）',
  balloon:          '到期一次還清',
};

// 台灣主要銀行參考利率（2024年底，僅供試算）
export const BANK_REFERENCE_RATES: Record<string, { mortgage: number; credit: number; car: number }> = {
  '台灣銀行': { mortgage: 2.17, credit: 3.80, car: 3.20 },
  '合作金庫': { mortgage: 2.18, credit: 3.85, car: 3.25 },
  '第一銀行': { mortgage: 2.19, credit: 3.90, car: 3.30 },
  '華南銀行': { mortgage: 2.20, credit: 3.95, car: 3.35 },
  '國泰世華': { mortgage: 2.25, credit: 4.00, car: 3.40 },
  '玉山銀行': { mortgage: 2.22, credit: 3.95, car: 3.38 },
  '中信銀行': { mortgage: 2.23, credit: 4.10, car: 3.45 },
  '富邦銀行': { mortgage: 2.21, credit: 4.05, car: 3.42 },
  '土地銀行': { mortgage: 2.15, credit: 3.75, car: 3.15 },   // 最低（公股首選）
  '郵政儲金': { mortgage: 2.16, credit: 3.78, car: 3.18 },
};

// In-memory store
const loanStore = new Map<string, LoanRecord>();

// ── Firestore ─────────────────────────────────────────────────────
async function getFirestore(): Promise<FirebaseFirestore.Firestore | null> {
  try {
    const { getFirestore: getFs } = await import('firebase-admin/firestore' as string) as {
      getFirestore: () => FirebaseFirestore.Firestore;
    };
    return getFs();
  } catch {
    return null;
  }
}

// ── CRUD ─────────────────────────────────────────────────────────

export async function addLoan(loan: LoanRecord): Promise<void> {
  loanStore.set(loan.loan_id, loan);
  try {
    const db = await getFirestore();
    if (db) await db.collection('loan_records').doc(loan.loan_id).set(loan);
  } catch (err) {
    logger.warn(`[LoanStore] Firestore write failed: ${err}`);
  }
}

export async function queryLoans(opts: {
  entity_type?: EntityType;
  category?: LoanCategory;
  status?: LoanStatus;
  limit?: number;
}): Promise<LoanRecord[]> {
  try {
    const db = await getFirestore();
    if (db) {
      let q = db.collection('loan_records') as FirebaseFirestore.Query;
      if (opts.entity_type) q = q.where('entity_type', '==', opts.entity_type);
      if (opts.status)      q = q.where('status', '==', opts.status);
      if (opts.category)    q = q.where('category', '==', opts.category);
      q = q.orderBy('created_at', 'desc').limit(opts.limit ?? 100);
      const snap = await q.get();
      return snap.docs.map(d => d.data() as LoanRecord);
    }
  } catch { /* fallback */ }

  let loans = [...loanStore.values()];
  if (opts.entity_type) loans = loans.filter(l => l.entity_type === opts.entity_type);
  if (opts.status)      loans = loans.filter(l => l.status === opts.status);
  if (opts.category)    loans = loans.filter(l => l.category === opts.category);
  return loans.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, opts.limit ?? 100);
}

export async function deleteLoan(loanId: string): Promise<boolean> {
  const existed = loanStore.has(loanId);
  loanStore.delete(loanId);
  try {
    const db = await getFirestore();
    if (db) await db.collection('loan_records').doc(loanId).delete();
  } catch { /* ignore */ }
  return existed;
}

// ── 還款試算（確定性計算）────────────────────────────────────────

export interface AmortizationResult {
  principal: number;
  annual_rate: number;
  loan_months: number;
  monthly_rate: number;
  repayment_method: RepaymentMethod;
  monthly_payment_first: number;      // 第一期月繳
  monthly_payment_last?: number;      // 最後一期（等額本金用）
  total_payment: number;              // 總還款金額
  total_interest: number;             // 總利息
  interest_ratio_pct: number;         // 利息佔還款比例 (%)
  grace_period_months: number;
  grace_period_monthly?: number;      // 寬限期月繳（只繳息）
  schedule: Array<{                   // 還款時間表（最多前12期）
    period: number;
    payment: number;
    principal_paid: number;
    interest_paid: number;
    balance: number;
  }>;
  notes: string[];
}

/**
 * 還款試算引擎
 * 支援：等額本息 / 等額本金 / 只繳息（寬限期）
 */
export function calcAmortization(opts: {
  principal: number;
  annual_rate: number;           // 年利率 (%)
  loan_months: number;
  repayment_method?: RepaymentMethod;
  grace_period_months?: number;  // 寬限期（只繳息），不含在 loan_months 內
  show_schedule_months?: number; // 顯示幾期時間表，預設 12
}): AmortizationResult {
  const {
    principal, annual_rate, loan_months,
  } = opts;
  const repayment_method = opts.repayment_method ?? 'equal_payment';
  const grace_period_months = opts.grace_period_months ?? 0;
  const show_schedule = opts.show_schedule_months ?? 12;
  const monthly_rate = annual_rate / 100 / 12;

  // 寬限期月繳（只繳息）
  const grace_period_monthly = grace_period_months > 0
    ? Math.round(principal * monthly_rate)
    : undefined;

  let monthly_payment_first = 0;
  let monthly_payment_last: number | undefined;
  let total_payment = 0;
  let total_interest = 0;
  const schedule: AmortizationResult['schedule'] = [];
  const notes: string[] = [];

  if (repayment_method === 'equal_payment') {
    // 等額本息：M = P * r * (1+r)^n / ((1+r)^n - 1)
    if (monthly_rate === 0) {
      monthly_payment_first = Math.round(principal / loan_months);
    } else {
      const factor = Math.pow(1 + monthly_rate, loan_months);
      monthly_payment_first = Math.round(principal * monthly_rate * factor / (factor - 1));
    }
    total_payment = monthly_payment_first * loan_months;
    total_interest = total_payment - principal;

    // 產生時間表
    let balance = principal;
    for (let i = 1; i <= Math.min(show_schedule, loan_months); i++) {
      const interest_paid = Math.round(balance * monthly_rate);
      const principal_paid = monthly_payment_first - interest_paid;
      balance = Math.max(0, balance - principal_paid);
      schedule.push({ period: i, payment: monthly_payment_first, principal_paid, interest_paid, balance });
    }
    notes.push('等額本息：每期還款金額固定，初期利息佔比較高');

  } else if (repayment_method === 'equal_principal') {
    // 等額本金：每期還固定本金 + 遞減利息
    const principal_per_period = Math.round(principal / loan_months);
    let balance = principal;
    total_payment = 0;

    for (let i = 1; i <= loan_months; i++) {
      const interest_paid = Math.round(balance * monthly_rate);
      const payment = principal_per_period + interest_paid;
      balance = Math.max(0, balance - principal_per_period);
      total_payment += payment;
      if (i <= show_schedule) {
        schedule.push({ period: i, payment, principal_paid: principal_per_period, interest_paid, balance });
      }
    }
    monthly_payment_first = schedule[0]?.payment ?? principal_per_period;
    monthly_payment_last = principal_per_period + Math.round(principal_per_period * monthly_rate);
    total_interest = total_payment - principal;
    notes.push('等額本金：每期本金固定，月繳遞減，總利息比等額本息少');

  } else if (repayment_method === 'interest_only') {
    monthly_payment_first = Math.round(principal * monthly_rate);
    total_payment = monthly_payment_first * loan_months + principal;
    total_interest = monthly_payment_first * loan_months;
    for (let i = 1; i <= Math.min(show_schedule, loan_months); i++) {
      schedule.push({ period: i, payment: monthly_payment_first, principal_paid: 0, interest_paid: monthly_payment_first, balance: principal });
    }
    notes.push('只繳息：每期只繳利息，到期一次清償本金');
  }

  // 加寬限期說明
  if (grace_period_months > 0 && grace_period_monthly) {
    notes.push(`寬限期（${grace_period_months}個月）月繳利息: NT$${grace_period_monthly.toLocaleString()}`);
    total_payment += grace_period_monthly * grace_period_months;
    total_interest += grace_period_monthly * grace_period_months;
  }

  // 利率警示
  if (annual_rate > 8) notes.push('⚠️ 年利率偏高（>8%），建議比較其他機構或考慮擔保品降低利率');
  if (annual_rate < 1.5) notes.push('💡 利率極低，可能為政策性貸款或特殊方案');
  if (loan_months > 360) notes.push('⚠️ 貸款期間超過30年，請確認實際年齡與銀行規定');

  const interest_ratio_pct = total_payment > 0 ? (total_interest / total_payment * 100) : 0;

  return {
    principal, annual_rate, loan_months, monthly_rate,
    repayment_method, monthly_payment_first, monthly_payment_last,
    total_payment, total_interest,
    interest_ratio_pct: Math.round(interest_ratio_pct * 10) / 10,
    grace_period_months, grace_period_monthly,
    schedule,
    notes,
  };
}

// ── 房貸試算（含額度評估）────────────────────────────────────────

export interface MortgageResult extends AmortizationResult {
  property_value: number;
  max_ltv_pct: number;            // 最高貸款成數 (%)
  max_loan_amount: number;        // 最高可貸金額
  requested_loan: number;         // 申請貸款金額
  ltv_pct: number;                // 實際貸款成數 (%)
  dsr_pct: number;                // 債務收入比 DSR (%)
  is_dsr_ok: boolean;             // DSR 是否符合標準（<= 33%）
  monthly_income_required: number; // 核貸所需月收入
  bank_suggestions: Array<{ bank: string; rate: number; label: string }>;
}

/**
 * 房貸試算（含貸款成數、DSR 評估）
 * 台灣房貸政策（2024）：
 *   - 第一棟：最高貸款成數 80%（特定地區限 70%）
 *   - 第二棟：最高 60%
 *   - DSR 標準：月繳 <= 月收入 33%
 */
export function calcMortgage(opts: {
  property_value: number;
  loan_amount: number;
  annual_rate: number;
  loan_months: number;
  monthly_income?: number;          // 月收入（用於 DSR 評估）
  is_first_house?: boolean;
  grace_period_months?: number;
  repayment_method?: RepaymentMethod;
}): MortgageResult {
  const {
    property_value, loan_amount, annual_rate, loan_months,
    monthly_income = 0,
  } = opts;
  const is_first_house = opts.is_first_house ?? true;
  const grace_period_months = opts.grace_period_months ?? 0;
  const repayment_method = opts.repayment_method ?? 'equal_payment';

  const max_ltv_pct = is_first_house ? 80 : 60;
  const max_loan_amount = Math.round(property_value * max_ltv_pct / 100);
  const ltv_pct = Math.round(loan_amount / property_value * 1000) / 10;

  const base = calcAmortization({ principal: loan_amount, annual_rate, loan_months, repayment_method, grace_period_months });

  // DSR 評估
  const monthly_payment_for_dsr = grace_period_months > 0
    ? (base.grace_period_monthly ?? base.monthly_payment_first)
    : base.monthly_payment_first;
  const dsr_pct = monthly_income > 0
    ? Math.round(monthly_payment_for_dsr / monthly_income * 1000) / 10
    : 0;
  const is_dsr_ok = monthly_income === 0 || dsr_pct <= 33;
  const monthly_income_required = Math.ceil(monthly_payment_for_dsr / 0.33);

  // 銀行利率建議（取最低前5）
  const bank_suggestions = Object.entries(BANK_REFERENCE_RATES)
    .map(([bank, rates]) => ({ bank, rate: rates.mortgage, label: '' }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5)
    .map(b => ({
      ...b,
      label: `NT$${Math.round(loan_amount * b.rate / 100 / 12).toLocaleString()}/月利息`,
    }));

  if (!is_dsr_ok) {
    base.notes.push(`⚠️ DSR ${dsr_pct}% 超過 33%，銀行可能不予核貸`);
    base.notes.push(`核貸所需月收入至少: NT$${monthly_income_required.toLocaleString()}`);
  }
  if (loan_amount > max_loan_amount) {
    base.notes.push(`⚠️ 超過最高貸款成數（${max_ltv_pct}% = NT$${max_loan_amount.toLocaleString()}）`);
  }

  return {
    ...base,
    property_value, max_ltv_pct, max_loan_amount,
    requested_loan: loan_amount, ltv_pct,
    dsr_pct, is_dsr_ok, monthly_income_required, bank_suggestions,
  };
}

// ── 車貸試算 ─────────────────────────────────────────────────────

export interface CarLoanResult extends AmortizationResult {
  vehicle_price: number;
  down_payment: number;
  down_payment_pct: number;         // 頭期款比例 (%)
  loan_amount: number;
  recommended_down_pct: number;     // 建議頭期款比例
}

export function calcCarLoan(opts: {
  vehicle_price: number;
  down_payment: number;
  annual_rate: number;
  loan_months: number;
}): CarLoanResult {
  const { vehicle_price, down_payment, annual_rate, loan_months } = opts;
  const loan_amount = vehicle_price - down_payment;
  const down_payment_pct = Math.round(down_payment / vehicle_price * 1000) / 10;
  const recommended_down_pct = vehicle_price > 1_500_000 ? 30 : 20;

  const base = calcAmortization({ principal: loan_amount, annual_rate, loan_months });

  if (down_payment_pct < recommended_down_pct) {
    base.notes.push(`💡 建議頭期款至少 ${recommended_down_pct}%，可降低月繳壓力`);
  }
  if (annual_rate > 5) {
    base.notes.push('⚠️ 車貸利率偏高，建議比較各銀行方案或考慮現金購車');
  }

  return { ...base, vehicle_price, down_payment, down_payment_pct, loan_amount, recommended_down_pct };
}

// ── 貸款比較（最多4個方案）──────────────────────────────────────

export interface LoanCompareResult {
  plans: Array<{
    label: string;
    principal: number;
    annual_rate: number;
    loan_months: number;
    repayment_method: RepaymentMethod;
    monthly_payment: number;
    total_payment: number;
    total_interest: number;
    interest_ratio_pct: number;
  }>;
  best_monthly: string;     // 月繳最低
  best_total: string;       // 總還款最低
  recommendation: string;
}

export function compareLoanPlans(plans: Array<{
  label: string;
  principal: number;
  annual_rate: number;
  loan_months: number;
  repayment_method?: RepaymentMethod;
}>): LoanCompareResult {
  const results = plans.slice(0, 4).map(p => {
    const r = calcAmortization({
      principal: p.principal, annual_rate: p.annual_rate,
      loan_months: p.loan_months, repayment_method: p.repayment_method,
    });
    return {
      label: p.label,
      principal: p.principal,
      annual_rate: p.annual_rate,
      loan_months: p.loan_months,
      repayment_method: p.repayment_method ?? 'equal_payment',
      monthly_payment: r.monthly_payment_first,
      total_payment: r.total_payment,
      total_interest: r.total_interest,
      interest_ratio_pct: r.interest_ratio_pct,
    };
  });

  const best_monthly = results.reduce((a, b) => a.monthly_payment < b.monthly_payment ? a : b).label;
  const best_total = results.reduce((a, b) => a.total_payment < b.total_payment ? a : b).label;

  const recommendation = best_monthly === best_total
    ? `推薦方案：${best_total}（月繳最低且總還款最少）`
    : `月繳最輕：${best_monthly}；總成本最低：${best_total}（視資金壓力選擇）`;

  return { plans: results, best_monthly, best_total, recommendation };
}

// ── 負債整合分析（Debt Consolidation）────────────────────────────

export interface DebtConsolidationResult {
  current_loans: LoanRecord[];
  current_total_monthly: number;
  current_total_outstanding: number;
  current_total_interest_remaining: number;
  consolidation_rate: number;
  consolidation_months: number;
  consolidated_monthly: number;
  consolidated_total_interest: number;
  monthly_saving: number;
  interest_saving: number;
  is_beneficial: boolean;
  recommendation: string;
}

/** 負債整合試算：把多筆貸款合一，評估是否划算 */
export async function analyzeDebtConsolidation(consolidation_rate: number, consolidation_months: number): Promise<DebtConsolidationResult> {
  const activeLoans = await queryLoans({ status: 'active', limit: 100 });

  const current_total_monthly = activeLoans.reduce((s, l) => s + l.monthly_payment, 0);
  const current_total_outstanding = activeLoans.reduce((s, l) => s + l.outstanding_balance, 0);

  // 估算剩餘利息（簡化計算）
  const current_total_interest_remaining = activeLoans.reduce((s, l) => {
    const remaining = calcAmortization({
      principal: l.outstanding_balance,
      annual_rate: l.annual_rate,
      loan_months: l.remaining_months,
      repayment_method: l.repayment_method,
    });
    return s + remaining.total_interest;
  }, 0);

  const consolidated = calcAmortization({
    principal: current_total_outstanding,
    annual_rate: consolidation_rate,
    loan_months: consolidation_months,
  });

  const monthly_saving = current_total_monthly - consolidated.monthly_payment_first;
  const interest_saving = current_total_interest_remaining - consolidated.total_interest;
  const is_beneficial = monthly_saving > 0 || interest_saving > 0;

  const recommendation = is_beneficial
    ? `✅ 整合後月繳${monthly_saving > 0 ? `節省 NT$${monthly_saving.toLocaleString()}` : '略增'}，總利息${interest_saving > 0 ? `節省 NT$${interest_saving.toLocaleString()}` : '略增'}，建議整合`
    : `⚠️ 整合後${monthly_saving < 0 ? `月繳增加 NT$${Math.abs(monthly_saving).toLocaleString()}` : ''}且總利息未減少，不建議整合`;

  return {
    current_loans: activeLoans,
    current_total_monthly,
    current_total_outstanding,
    current_total_interest_remaining,
    consolidation_rate,
    consolidation_months,
    consolidated_monthly: consolidated.monthly_payment_first,
    consolidated_total_interest: consolidated.total_interest,
    monthly_saving,
    interest_saving,
    is_beneficial,
    recommendation,
  };
}

// ── 彙總分析 ─────────────────────────────────────────────────────

export async function calcLoanSummary(): Promise<{
  by_entity: Array<{
    entity_type: EntityType;
    entity_label: string;
    total_outstanding: number;
    total_monthly_payment: number;
    active_count: number;
    loans: LoanRecord[];
  }>;
  grand_total_outstanding: number;
  grand_total_monthly: number;
}> {
  const allActive = await queryLoans({ status: 'active', limit: 500 });
  const byEntity = ALL_ENTITIES.map(et => {
    const ls = allActive.filter(l => l.entity_type === et);
    return {
      entity_type: et,
      entity_label: ENTITY_ZH[et],
      total_outstanding: ls.reduce((s, l) => s + l.outstanding_balance, 0),
      total_monthly_payment: ls.reduce((s, l) => s + l.monthly_payment, 0),
      active_count: ls.length,
      loans: ls,
    };
  });
  return {
    by_entity: byEntity,
    grand_total_outstanding: byEntity.reduce((s, e) => s + e.total_outstanding, 0),
    grand_total_monthly: byEntity.reduce((s, e) => s + e.total_monthly_payment, 0),
  };
}
