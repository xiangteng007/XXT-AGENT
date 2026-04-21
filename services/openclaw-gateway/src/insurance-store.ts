/**
 * InsuranceStore — 保單資料管理引擎
 *
 * 支援 7 實體（v6.0 EntityType）的保單 CRUD
 * 持久化至 Firestore insurance_policies；本地 in-memory fallback
 * 保單號碼僅儲存後4碼（masked），不儲存完整號碼
 */

import { logger } from './logger';
import { type EntityType, entityShortLabel, ALL_ENTITIES } from './entity';

// ── 型別 re-export ───────────────────────────────────────────────────
export type { EntityType } from './entity';

export type PolicyCategory =
  // 工程公司
  | 'car_insurance'       // 工程綜合險 (CAR)
  | 'pli'                 // 公共意外責任險
  | 'workers_comp'        // 職業災害保險（法定）
  | 'performance_bond'    // 履約保證保險
  | 'equipment'           // 機具設備險
  | 'employers_liability' // 僱主意外責任險
  | 'defect_liability'    // 工程缺陷責任保險 (DII)
  // 個人
  | 'life_term'           // 定期壽險
  | 'life_whole'          // 終身壽險
  | 'medical'             // 醫療險
  | 'critical_illness'    // 重大傷病險
  | 'disability'          // 失能險（長照）
  | 'accident'            // 意外險
  // 家庭
  | 'house_fire'          // 住宅火險
  | 'earthquake'          // 地震基本保險
  | 'family_liability'    // 家庭責任險
  | 'vehicle_compulsory'  // 強制汽機車責任險
  | 'vehicle_optional'    // 任意汽機車險
  | 'long_term_care'      // 長照保險
  | 'children_accident'   // 子女傷害險
  | 'other';

export type PaymentFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
export type PolicyStatus = 'active' | 'lapsed' | 'expired' | 'pending';

export interface InsurancePolicy {
  policy_id: string;
  entity_type: EntityType;
  category: PolicyCategory;
  insurer: string;               // 保險公司名稱（如：國泰人壽）
  policy_no_masked: string;      // 保單號碼後4碼（加密保護）
  insured_name: string;          // 被保人姓名
  beneficiary?: string;          // 受益人（壽險適用）
  sum_insured: number;           // 保額 (TWD)
  annual_premium: number;        // 年繳保費 (TWD)
  payment_frequency: PaymentFrequency;
  start_date: string;            // YYYY-MM-DD
  end_date: string;              // YYYY-MM-DD 或 'lifetime'
  is_mandatory: boolean;         // 法定強制保險
  status: PolicyStatus;
  project_id?: string;           // 工程案ID（工程險使用）
  project_name?: string;         // 工程名稱
  notes?: string;
  created_at: string;
  updated_at: string;
  ledger_linked: boolean;        // 是否已同步至帳本 life_insurance 科目
  ledger_entry_id?: string;      // 關聯的帳本 entry_id
}

// ── 中文對照 ────────────────────────────────────────────────────

export const CATEGORY_ZH: Record<PolicyCategory, string> = {
  car_insurance:       '工程綜合險',
  pli:                 '公共意外責任險',
  workers_comp:        '職業災害保險',
  performance_bond:    '履約保證保險',
  equipment:           '機具設備險',
  employers_liability: '僱主意外責任險',
  defect_liability:    '工程缺陷責任保險',
  life_term:           '定期壽險',
  life_whole:          '終身壽險',
  medical:             '醫療險',
  critical_illness:    '重大傷病險',
  disability:          '失能險',
  accident:            '意外險',
  house_fire:          '住宅火險',
  earthquake:          '地震基本保險',
  family_liability:    '家庭責任險',
  vehicle_compulsory:  '強制汽機車責任險',
  vehicle_optional:    '任意汽機車險',
  long_term_care:      '長照保險',
  children_accident:   '子女傷害險',
  other:               '其他保險',
};

// 實體中文標示（動態生成，支援 7 實體）
export const ENTITY_ZH: Record<string, string> = Object.fromEntries(
  ALL_ENTITIES.map(e => [e, entityShortLabel(e)]),
);

// 法定強制保險清單
export const MANDATORY_CATEGORIES: PolicyCategory[] = [
  'workers_comp',
  'vehicle_compulsory',
  'earthquake',   // 有房貸時強制
];

// 建議保額佔公司年收入的比例（工程公司）
export const RECOMMENDED_PLI_RATIO = 0.03;  // 年收入的 3%（最低 NT$1,000萬）

// ── In-memory 儲存（Firestore fallback）────────────────────────
const policiesStore = new Map<string, InsurancePolicy>();

// ── Firestore 整合（與 context-store 相同模式）────────────────
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

// ── CRUD 函數 ────────────────────────────────────────────────────

/** 新增保單 */
export async function addPolicy(policy: InsurancePolicy): Promise<void> {
  policiesStore.set(policy.policy_id, policy);
  try {
    const db = await getFirestore();
    if (db) {
      await db.collection('insurance_policies').doc(policy.policy_id).set(policy);
    }
  } catch (err) {
    logger.warn(`[InsuranceStore] Firestore write failed, using memory: ${err}`);
  }
}

/** 查詢保單（支援多種過濾條件） */
export async function queryPolicies(opts: {
  entity_type?: EntityType;
  category?: PolicyCategory;
  status?: PolicyStatus;
  project_id?: string;
  limit?: number;
}): Promise<InsurancePolicy[]> {
  // 先從 Firestore 嘗試
  try {
    const db = await getFirestore();
    if (db) {
      let q = db.collection('insurance_policies') as FirebaseFirestore.Query;
      if (opts.entity_type) q = q.where('entity_type', '==', opts.entity_type);
      if (opts.status)      q = q.where('status', '==', opts.status);
      if (opts.category)    q = q.where('category', '==', opts.category);
      if (opts.project_id)  q = q.where('project_id', '==', opts.project_id);
      q = q.orderBy('created_at', 'desc').limit(opts.limit ?? 100);
      const snap = await q.get();
      return snap.docs.map(d => d.data() as InsurancePolicy);
    }
  } catch {
    /* fallback */
  }

  // In-memory fallback
  let policies = [...policiesStore.values()];
  if (opts.entity_type) policies = policies.filter(p => p.entity_type === opts.entity_type);
  if (opts.status)      policies = policies.filter(p => p.status === opts.status);
  if (opts.category)    policies = policies.filter(p => p.category === opts.category);
  if (opts.project_id)  policies = policies.filter(p => p.project_id === opts.project_id);
  return policies
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, opts.limit ?? 100);
}

/** 取得單筆保單 */
export async function getPolicyById(policyId: string): Promise<InsurancePolicy | null> {
  if (policiesStore.has(policyId)) return policiesStore.get(policyId)!;
  try {
    const db = await getFirestore();
    if (db) {
      const doc = await db.collection('insurance_policies').doc(policyId).get();
      if (doc.exists) {
        const data = doc.data() as InsurancePolicy;
        policiesStore.set(policyId, data);
        return data;
      }
    }
  } catch { /* ignore */ }
  return null;
}

/** 刪除保單 */
export async function deletePolicy(policyId: string): Promise<boolean> {
  const existed = policiesStore.has(policyId);
  policiesStore.delete(policyId);
  try {
    const db = await getFirestore();
    if (db) {
      await db.collection('insurance_policies').doc(policyId).delete();
    }
  } catch { /* ignore */ }
  return existed;
}

/** 更新保單狀態 */
export async function updatePolicyStatus(policyId: string, status: PolicyStatus): Promise<void> {
  const p = policiesStore.get(policyId);
  if (p) {
    p.status = status;
    p.updated_at = new Date().toISOString();
    policiesStore.set(policyId, p);
  }
  try {
    const db = await getFirestore();
    if (db) {
      await db.collection('insurance_policies').doc(policyId).update({
        status, updated_at: new Date().toISOString(),
      });
    }
  } catch { /* ignore */ }
}

/** 標記保單已連結帳本 */
export async function markLedgerLinked(policyId: string, entryId?: string): Promise<void> {
  const p = policiesStore.get(policyId);
  if (p) { p.ledger_linked = true; if (entryId) p.ledger_entry_id = entryId; }
  try {
    const db = await getFirestore();
    if (db) {
      const updateData: any = { ledger_linked: true };
      if (entryId) updateData.ledger_entry_id = entryId;
      await db.collection('insurance_policies').doc(policyId).update(updateData);
    }
  } catch { /* ignore */ }
}

// ── 彙總分析函數 ─────────────────────────────────────────────────

/** 計算各實體保費彙總 */
export async function calcPremiumSummary(): Promise<{
  by_entity: Array<{
    entity_type: EntityType;
    entity_label: string;
    total_annual_premium: number;
    active_count: number;
    policies: InsurancePolicy[];
  }>;
  grand_total: number;
}> {
  const allActive = await queryPolicies({ status: 'active', limit: 500 });
  const byEntity = ALL_ENTITIES.map(et => {
    const ps = allActive.filter(p => p.entity_type === et);
    return {
      entity_type: et,
      entity_label: ENTITY_ZH[et],
      total_annual_premium: ps.reduce((s, p) => s + p.annual_premium, 0),
      active_count: ps.length,
      policies: ps,
    };
  });
  return {
    by_entity: byEntity,
    grand_total: byEntity.reduce((s, e) => s + e.total_annual_premium, 0),
  };
}

/** 取得強制保險缺口 */
export async function getMandatoryGap(): Promise<{
  missing: PolicyCategory[];
  present: PolicyCategory[];
}> {
  const active = await queryPolicies({ status: 'active', limit: 500 });
  const activeCategories = new Set(active.map(p => p.category));
  const missing = MANDATORY_CATEGORIES.filter(c => !activeCategories.has(c));
  const present = MANDATORY_CATEGORIES.filter(c => activeCategories.has(c));
  return { missing, present };
}

// ── 工程險費率試算（確定性計算，無 LLM）─────────────────────────

export interface CarCalcResult {
  project_name?: string;
  contract_value: number;
  duration_months: number;
  workers: number;
  // CAR
  car_rate_pct: number;
  car_premium: number;
  car_sum_insured: number;
  // PLI
  pli_sum_insured: number;
  pli_rate_pct: number;
  pli_premium: number;
  // 職災
  workers_comp_monthly: number;
  workers_comp_annual: number;
  // 合計
  total_annual_premium: number;
  // 說明
  notes: string[];
  legal_basis: string;
}

/**
 * 工程保險費率試算
 * 費率來源：台灣產險業市場慣用費率（2024）
 * CAR: 合約總值 × 0.10%-0.30%（依工程複雜度）
 * PLI: 保額 × 0.05%-0.15%（依工班人數）
 * 保額下限：PLI NT$1,000萬（工程發包慣例）
 */
export function calcCarPremium(opts: {
  contract_value: number;         // 工程合約總值 (TWD)
  duration_months: number;        // 工期（月數）
  workers: number;                // 工班人數
  project_name?: string;
  complexity?: 'low' | 'medium' | 'high';  // 工程複雜度
}): CarCalcResult {
  const { contract_value, duration_months, workers, project_name } = opts;
  const complexity = opts.complexity ?? (contract_value > 50_000_000 ? 'high' : contract_value > 10_000_000 ? 'medium' : 'low');

  // CAR 費率（年化）
  const CAR_RATE: Record<string, number> = { low: 0.0010, medium: 0.0018, high: 0.0028 };
  const car_rate = CAR_RATE[complexity]!;
  const car_sum_insured = contract_value;
  const car_premium_annual = Math.round(car_sum_insured * car_rate);
  const car_premium = Math.round(car_premium_annual * (duration_months / 12));

  // PLI 保額（依合約值決定下限）
  const PLI_MIN = 10_000_000;
  const PLI_RATIO = 0.20;  // 合約值的 20% 或最低 1,000萬，取較大
  const pli_sum_insured = Math.max(PLI_MIN, Math.round(contract_value * PLI_RATIO));

  // PLI 費率（依工班人數調整）
  const pli_base_rate = workers <= 10 ? 0.0006 : workers <= 30 ? 0.0009 : 0.0012;
  const pli_premium_annual = Math.round(pli_sum_insured * pli_base_rate);
  const pli_premium = Math.round(pli_premium_annual * (duration_months / 12));

  // 職災保險（依人數估算）
  // 月繳約 NT$350-500/人（含勞保職災部分費率）
  const WORKERS_COMP_PER_PERSON = 420;
  const workers_comp_monthly = Math.round(workers * WORKERS_COMP_PER_PERSON);
  const workers_comp_annual = workers_comp_monthly * 12;

  const total_annual_premium = car_premium + pli_premium + workers_comp_annual;

  const notes: string[] = [
    `工程複雜度: ${complexity === 'low' ? '一般' : complexity === 'medium' ? '中等' : '高複雜'}`,
    `CAR 費率: ${(car_rate * 100).toFixed(2)}%（工程期間合計）`,
    `PLI 保額: NT$${pli_sum_insured.toLocaleString()}（最低 NT$1,000 萬）`,
    `PLI 費率: ${(pli_base_rate * 100).toFixed(2)}%（工班人數 ${workers} 人調整）`,
    `職災保險: NT$${WORKERS_COMP_PER_PERSON}/月/人 × ${workers} 人`,
  ];

  if (contract_value > 100_000_000) {
    notes.push('⚠️ 超大型工程建議另加「工程延誤損失險」與「第三人財損擴展條款」');
  }
  if (workers > 50) {
    notes.push('⚠️ 工班超過 50 人建議另投「團體傷害保險」補強個人意外保障');
  }

  return {
    project_name,
    contract_value,
    duration_months,
    workers,
    car_rate_pct: car_rate * 100,
    car_premium,
    car_sum_insured,
    pli_sum_insured,
    pli_rate_pct: pli_base_rate * 100,
    pli_premium,
    workers_comp_monthly,
    workers_comp_annual,
    total_annual_premium,
    notes,
    legal_basis: '費率依台灣產險市場慣用費率（2024年）；職災保費依《職業安全衛生法》第 40 條及勞保費率計算',
  };
}

// ── 壽險保額計算（DIME 法則）────────────────────────────────────

export interface DiMEResult {
  annual_salary: number;
  debts: number;
  income_replacement_years: number;
  mortgage: number;
  education_fund: number;
  dime_breakdown: {
    D: number;  // Debt
    I: number;  // Income replacement
    M: number;  // Mortgage
    E: number;  // Education
  };
  minimum_coverage: number;
  recommended_coverage: number;
  monthly_premium_estimate: number;
  notes: string[];
}

/**
 * DIME 法則壽險保額計算
 * D = 負債總額
 * I = 年薪 × 替代年數（預設 10 年）
 * M = 房貸餘額
 * E = 子女教育費（每位 NT$120 萬估算至大學）
 */
export function calcLifeInsurance(opts: {
  annual_salary: number;
  debts?: number;
  income_years?: number;    // 收入替代年數，預設 10
  mortgage?: number;
  children?: number;        // 子女人數
  education_per_child?: number;  // 每位子女教育費，預設 120萬
}): DiMEResult {
  const {
    annual_salary,
    debts = 0,
    mortgage = 0,
    children = 0,
  } = opts;
  const income_years = opts.income_years ?? 10;
  const education_per_child = opts.education_per_child ?? 1_200_000;

  const D = debts;
  const I = annual_salary * income_years;
  const M = mortgage;
  const E = children * education_per_child;

  const minimum_coverage = D + I + M + E;
  const recommended_coverage = Math.round(minimum_coverage * 1.2);  // 加 20% 緩衝

  // 定期壽險費率估算（35歲男性，20年期，費率約萬分之 1.2）
  const term_rate = 0.00012;
  const monthly_premium_estimate = Math.round(recommended_coverage * term_rate / 12);

  const notes: string[] = [
    `D（負債清償）: NT$${D.toLocaleString()}`,
    `I（收入替代 ${income_years} 年）: NT$${I.toLocaleString()}`,
    `M（房貸餘額）: NT$${M.toLocaleString()}`,
    `E（子女教育費 ${children} 人）: NT$${E.toLocaleString()}`,
    `建議保額 = 最低保額 × 120% 安全緩衝`,
  ];

  if (minimum_coverage < 5_000_000) {
    notes.push('⚠️ 保額偏低，建議至少 NT$500 萬作為基本生活保障');
  }
  if (annual_salary > 0 && minimum_coverage / annual_salary < 5) {
    notes.push('⚠️ 保額/年薪比例低於 5 倍，行業建議 8-12 倍');
  }

  return {
    annual_salary,
    debts,
    income_replacement_years: income_years,
    mortgage,
    education_fund: E,
    dime_breakdown: { D, I, M, E },
    minimum_coverage,
    recommended_coverage,
    monthly_premium_estimate,
    notes,
  };
}

// ── 職災補償試算（勞基法 §59）──────────────────────────────────

export interface WorkersCompResult {
  monthly_salary: number;
  daily_salary: number;
  workers: number;
  // 各補償項目上限
  medical_limit: number;          // 醫療費用補償（實支實付，無上限）
  disability_daily: number;       // 失能補償（日薪×期間）
  permanent_disability_max: number; // 永久失能補償上限
  death_compensation: number;     // 死亡補償
  funeral_allowance: number;      // 喪葬費
  // 總最大理賠估算
  worst_case_per_person: number;
  worst_case_total: number;
  // 建議保險金額
  recommended_coverage_per_person: number;
  legal_basis: string;
  notes: string[];
}

/**
 * 職災補償試算（依勞動基準法第 59 條）
 * 死亡或永久失能：40 個月平均工資
 * 短期失能：工資 70%（住院期間）
 */
export function calcWorkersComp(opts: {
  monthly_salary: number;
  workers?: number;
}): WorkersCompResult {
  const { monthly_salary, workers = 1 } = opts;
  const daily_salary = Math.round(monthly_salary * 12 / 365);

  // §59 補償計算
  const medical_limit = 0;          // 實支實付（無上限）
  const disability_daily = Math.round(daily_salary * 0.7);  // 失能期間 70% 日薪
  const permanent_disability_max = monthly_salary * 40;     // 40 個月工資
  const death_compensation = monthly_salary * 40;           // 同永久失能
  const funeral_allowance = monthly_salary * 5;             // 5 個月工資

  // 最壞情況（死亡）每人
  const worst_case_per_person = death_compensation + funeral_allowance + 600_000;  // 加估醫療費 60萬
  const worst_case_total = worst_case_per_person * workers;

  // 建議保額（加 30% 訴訟和解緩衝）
  const recommended_coverage_per_person = Math.round(worst_case_per_person * 1.3);

  const notes: string[] = [
    `日薪基礎: NT$${daily_salary.toLocaleString()}（月薪 × 12 ÷ 365）`,
    `失能期間補償: 日薪 × 70% = NT$${disability_daily.toLocaleString()}/日`,
    `永久失能/死亡: 月薪 × 40 個月 = NT$${permanent_disability_max.toLocaleString()}`,
    `喪葬費: 月薪 × 5 個月 = NT$${funeral_allowance.toLocaleString()}`,
    `⚠️ 以上為法定最低補償，實際訴訟和解金額常高出 30-50%`,
    `建議投「僱主意外責任險」轉嫁超額補償風險`,
  ];

  return {
    monthly_salary,
    daily_salary,
    workers,
    medical_limit,
    disability_daily,
    permanent_disability_max,
    death_compensation,
    funeral_allowance,
    worst_case_per_person,
    worst_case_total,
    recommended_coverage_per_person,
    legal_basis: '依《勞動基準法》第 59 條職業災害補償規定',
    notes,
  };
}
