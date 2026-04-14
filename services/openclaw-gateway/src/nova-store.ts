/**
 * Nova Agent Store — 員工資料 + 薪資記錄持久化 (E-1)
 *
 * Firestore 集合:
 *   employees/         → 員工基本資料 + 勞保/健保投保薪資
 *   payroll_records/   → 每月薪資計算記錄
 *
 * 跨 Agent 協作:
 *   payroll 發放後 → 通知 Accountant 記入 ledger（expense/labor）
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from './logger';

// ── 型別定義 ──────────────────────────────────────────────────

export type EmploymentStatus = 'active' | 'inactive' | 'on_leave';
export type EntityType = 'co_construction' | 'co_renovation' | 'co_design' | 'co_drone';

export interface Employee {
  employee_id: string;
  company_id: string;
  entity_type: EntityType;

  /** 基本資料 */
  name: string;
  id_no_masked: string;         // 身分證後 4 碼（如 ***1234）
  birthday?: string;            // YYYY-MM-DD
  hire_date: string;            // YYYY-MM-DD
  resign_date?: string;         // YYYY-MM-DD（離職日）
  status: EmploymentStatus;

  /** 薪資設定 */
  base_salary: number;          // 月基本薪資（NT$）
  position: string;             // 職位（工地主任 / 測量員 / 行政）
  employment_type: 'full_time' | 'part_time' | 'contractor';

  /** 勞保/健保 */
  labor_insurance_bracket: number;   // 勞保投保薪資月額（分級表）
  health_insurance_bracket: number;  // 健保投保金額月額（分級表）
  health_dependents: number;         // 眷口數（影響員工健保自付額）

  /** 勞退 */
  pension_self_rate: number;    // 員工自提率 0-6（%）

  /** 聯絡 */
  phone?: string;
  bank_account?: string;        // 薪轉帳號敬業後 4 碼

  /** 元資料 */
  created_at: string;
  updated_at: string;
  created_by: string;
  notes?: string;
}

export interface PayrollOvertimeItem {
  date: string;           // YYYY-MM-DD
  hours: number;          // 加班時數
  type: 'weekday' | 'holiday';   // 平日 / 假日
}

export interface PayrollRecord {
  payroll_id: string;
  employee_id: string;
  company_id: string;
  entity_type: EntityType;

  /** 薪資期間 */
  period: string;               // YYYYMM（計薪月份）
  pay_date: string;             // YYYY-MM-DD（實發日）

  /** 薪資項目 */
  base_salary: number;
  overtime_pay: number;         // 加班費合計
  full_attendance_bonus: number; // 全勤獎金
  other_additions: number;       // 其他加項（伙食津貼等）
  other_deductions: number;      // 其他扣項（曠職扣款等）

  /** 法定扣繳 */
  labor_insurance_employee: number;    // 勞保費（員工自付）
  health_insurance_employee: number;   // 健保費（員工自付）
  withholding_tax: number;             // 預扣所得稅（按月扣繳）

  /** 計算結果 */
  gross_salary: number;         // 應領工資
  net_salary: number;           // 實領薪資

  /** 雇主負擔（記入帳本）*/
  employer_labor_insurance: number;
  employer_health_insurance: number;
  employer_pension: number;     // 勞退提撥

  /** 加班明細 */
  overtime_items: PayrollOvertimeItem[];

  /** 跨 Agent */
  ledger_entry_id?: string;     // Accountant 帳本 entry_id（薪資記帳後填入）

  created_at: string;
  created_by: string;
  notes?: string;
}

// ── 輔助函數 ──────────────────────────────────────────────────

/** 遮罩身分證（只保留後 4 碼） */
export function maskIdNo(idNo: string): string {
  return `***${idNo.slice(-4)}`;
}

/** 計算年資（完整月數） */
export function calcTenureMonths(hireDate: string, asOf?: string): number {
  const hire = new Date(hireDate);
  const ref  = asOf ? new Date(asOf) : new Date();
  return (ref.getFullYear() - hire.getFullYear()) * 12 +
         (ref.getMonth() - hire.getMonth());
}

/** 依年資（完整月）計算法定特休天數 */
export function calcAnnualLeave(tenureMonths: number): number {
  const years = tenureMonths / 12;
  if (years < 1)   return 0;
  if (years < 2)   return 3;
  if (years < 3)   return 6;
  if (years < 5)   return 14;
  if (years < 10)  return 15;
  return Math.min(15 + Math.floor(years - 10), 30);
}

/** 計算加班費 */
export function calcOvertimePay(
  hourlyRate: number,
  items: PayrollOvertimeItem[],
): number {
  let total = 0;
  for (const item of items) {
    if (item.type === 'weekday') {
      const first2  = Math.min(item.hours, 2);
      const beyond2 = Math.max(item.hours - 2, 0);
      total += first2 * hourlyRate * 1.34 + beyond2 * hourlyRate * 1.67;
    } else {
      // 假日
      const first8  = Math.min(item.hours, 8);
      const beyond8 = Math.max(item.hours - 8, 0);
      total += first8 * hourlyRate * 2.0 + beyond8 * hourlyRate * 2.67;
    }
  }
  return Math.round(total);
}

// ── Firestore CRUD ────────────────────────────────────────────

function db() { return getFirestore(); }

// ── 員工 CRUD ─────────────────────────────────────────────────

export async function addEmployee(emp: Employee): Promise<{ employee_id: string }> {
  const ref = db().collection('employees').doc(emp.employee_id);
  await ref.set({ ...emp, updated_at: new Date().toISOString() });
  logger.info(`[NovaStore] Employee added: ${emp.employee_id} ${emp.name}`);
  return { employee_id: emp.employee_id };
}

export async function updateEmployee(
  employee_id: string,
  updates: Partial<Employee>,
): Promise<void> {
  await db().collection('employees').doc(employee_id).update({
    ...updates,
    updated_at: new Date().toISOString(),
  });
}

export async function getEmployee(employee_id: string): Promise<Employee | null> {
  const snap = await db().collection('employees').doc(employee_id).get();
  return snap.exists ? (snap.data() as Employee) : null;
}

export interface QueryEmployeeOptions {
  entity_type?: EntityType;
  status?: EmploymentStatus;
  company_id?: string;
  limit?: number;
}

export async function queryEmployees(opts: QueryEmployeeOptions = {}): Promise<Employee[]> {
  let q: FirebaseFirestore.Query = db().collection('employees');
  if (opts.entity_type) q = q.where('entity_type', '==', opts.entity_type);
  if (opts.status)      q = q.where('status', '==', opts.status);
  if (opts.company_id)  q = q.where('company_id', '==', opts.company_id);
  q = q.orderBy('hire_date', 'desc').limit(opts.limit ?? 50);
  const snap = await q.get();
  return snap.docs.map(d => d.data() as Employee);
}

// ── 薪資記錄 CRUD ─────────────────────────────────────────────

export async function addPayroll(record: PayrollRecord): Promise<{ payroll_id: string }> {
  await db().collection('payroll_records').doc(record.payroll_id).set(record);
  logger.info(`[NovaStore] Payroll added: ${record.payroll_id} emp=${record.employee_id} period=${record.period}`);
  return { payroll_id: record.payroll_id };
}

export async function linkPayrollToLedger(
  payroll_id: string,
  ledger_entry_id: string,
): Promise<void> {
  await db().collection('payroll_records').doc(payroll_id).update({ ledger_entry_id });
}

export interface QueryPayrollOptions {
  employee_id?: string;
  entity_type?: EntityType;
  period?: string;       // YYYYMM
  year?: number;
  limit?: number;
}

export async function queryPayrolls(opts: QueryPayrollOptions = {}): Promise<PayrollRecord[]> {
  let q: FirebaseFirestore.Query = db().collection('payroll_records');
  if (opts.employee_id) q = q.where('employee_id', '==', opts.employee_id);
  if (opts.entity_type) q = q.where('entity_type', '==', opts.entity_type);
  if (opts.period)      q = q.where('period', '==', opts.period);
  if (opts.year)        q = q.where('period', '>=', `${opts.year}01`).where('period', '<=', `${opts.year}12`);
  q = q.orderBy('period', 'desc').limit(opts.limit ?? 50);
  const snap = await q.get();
  return snap.docs.map(d => d.data() as PayrollRecord);
}

/** 薪資發放後，透過 Cross-Agent Queue 通知 Accountant 記帳 */
export async function dispatchPayrollToLedger(
  record: PayrollRecord,
  employeeName: string,
): Promise<{ queued: boolean }> {
  try {
    const totalEmployerCost = record.base_salary +
      record.overtime_pay + record.full_attendance_bonus + record.other_additions +
      record.employer_labor_insurance + record.employer_health_insurance + record.employer_pension;

    const payload = {
      targetAgent: 'accountant',
      action: 'create_ledger_entry',
      payload: {
        type: 'expense',
        category: 'labor',
        description: `薪資發放 — ${employeeName} (${record.period})`,
        amount: totalEmployerCost,
        amount_type: 'taxed',
        is_tax_exempt: true,      // 薪資費用非銷項稅
        entity_type: record.entity_type,
        transaction_date: record.pay_date,
        notes: `payroll_id:${record.payroll_id} 淨薪:${record.net_salary}`,
        source_agent: 'nova',
        source_id: record.payroll_id,
      },
    };
    // 寫入 write_request Firestore Collection（供 Agent Bus 消費）
    await db().collection('write_requests').add({
      ...payload,
      created_at: new Date().toISOString(),
      status: 'pending',
    });
    logger.info(`[NovaStore] Payroll → Accountant write_request queued: ${record.payroll_id}`);
    return { queued: true };
  } catch (err) {
    logger.error(`[NovaStore] Failed to dispatch payroll to Accountant: ${err}`);
    return { queued: false };
  }
}
