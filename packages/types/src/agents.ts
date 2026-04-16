/**
 * @xxt-agent/types — Agent 型別定義 (B-4)
 *
 * 集中管理所有 Agent 相關型別，消除各 route 內的
 * inline type 重複定義。Gateway route 應從此處 import。
 *
 * @since v8.0
 */

import type { EntityType } from './index';

// ════════════════════════════════════════════════════════════════
// § 1  Agent ID 與 Chat 合約
// ════════════════════════════════════════════════════════════════

/** 所有已知 Agent 的 ID（與 agent-bus 保持同步）*/
export type AgentId =
  | 'accountant'    // 鳴鑫 — 會計師
  | 'guardian'      // 安盾 — 保險顧問
  | 'finance'       // 融鑫 — 財務顧問
  | 'scout'         // Scout — UAV 任務官
  | 'zora'          // Zora — 公益法人管家
  | 'lex'           // Lex  — 合約管家
  | 'nova'          // Nova — HR 管家
  | 'titan'         // Titan — BIM 建築師
  | 'lumi'          // Lumi — 室內設計師
  | 'rusty'         // Rusty — 工料估算師
  | 'invest'        // 投資決策引擎
  | 'sage';         // Sage — 知識管理 (v8)

export const ALL_AGENT_IDS: AgentId[] = [
  'accountant', 'guardian', 'finance', 'scout', 'zora', 'lex',
  'nova', 'titan', 'lumi', 'rusty', 'invest', 'sage',
];

/** 標準 Agent Chat 請求 */
export interface AgentChatRequest {
  /** 使用者訊息（必填）*/
  message: string;
  /** 會話 ID（可選，用於多輪對話）*/
  session_id?: string;
  /** 附加背景上下文 */
  context?: string;
  /** 指定法人實體（可選）*/
  entity_type?: EntityType;
}

/** 標準 Agent Chat 回應 */
export interface AgentChatResponse {
  agent_id: AgentId;
  session_id: string;
  /** AI 生成的回覆 */
  reply: string;
  /** 使用的推理模型 */
  model: string;
  /** 推理路徑 */
  inference_route: 'local' | 'cloud' | 'hybrid';
  /** 隱私等級 */
  privacy_level: 'PUBLIC' | 'INTERNAL' | 'PRIVATE';
  /** 延遲（毫秒）*/
  latency_ms: number;
  /** RAG 來源（若有使用）*/
  rag_source?: string;
  /** 追蹤 ID */
  trace_id: string;
}

/** Agent 健康檢查響應 */
export interface AgentHealthResponse {
  agent_id: AgentId;
  display_name: string;
  status: 'ready' | 'degraded' | 'offline';
  model: string;
  inference_route: 'local' | 'cloud';
  privacy_level: 'PUBLIC' | 'INTERNAL' | 'PRIVATE';
  capabilities: string[];
  collab_agents?: AgentId[];
  timestamp: string;
}

// ════════════════════════════════════════════════════════════════
// § 2  跨 Agent 協作（Collaboration）— C-1 系列
// ════════════════════════════════════════════════════════════════

/** 協作請求（Agent → Agent） */
export interface CollaborationRequest {
  /** 發起協作的 Agent */
  source_agent: AgentId;
  /** 目標 Agent */
  target_agent: AgentId;
  /** 協作動作類型 */
  action: CollaborationAction;
  /** 請求負載 */
  payload: Record<string, unknown>;
  /** 冪等性金鑰 */
  idempotency_key: string;
  /** 人類可讀原因 */
  reason: string;
  /** 時間戳 */
  timestamp: string;
}

/** 已知的跨 Agent 協作動作 */
export type CollaborationAction =
  // C-1a: Scout → Lex（UAV 合約）
  | 'SCOUT_REQUEST_CONTRACT'
  // C-1b: Guardian → Accountant（保費自動記帳）
  | 'GUARDIAN_PREMIUM_BOOKING'
  // C-1c: Zora → Accountant（捐款收入入帳）
  | 'ZORA_DONATION_BOOKING'
  // C-1d: Accountant ↔ Finance（對帳）
  | 'RECONCILE_REQUEST'
  | 'RECONCILE_RESPONSE';

/** 協作結果 */
export interface CollaborationResult {
  ok: boolean;
  source_agent: AgentId;
  target_agent: AgentId;
  action: CollaborationAction;
  request_id: string;
  status: 'completed' | 'queued' | 'failed' | 'already_processed';
  message: string;
  data?: Record<string, unknown>;
}

// ════════════════════════════════════════════════════════════════
// § 3  Accountant — Ledger 型別
// ════════════════════════════════════════════════════════════════

export type EntryType = 'income' | 'expense';

export type LedgerCategory =
  // Income
  | 'engineering_payment' | 'advance_payment' | 'design_fee'
  | 'consulting_fee' | 'material_rebate' | 'other_income'
  | 'salary' | 'freelance' | 'rental_income'
  | 'investment_gain' | 'allowance'
  // Expense
  | 'material' | 'labor' | 'subcontract' | 'equipment'
  | 'overhead' | 'insurance' | 'tax_payment' | 'utilities'
  | 'rent' | 'office_supply' | 'entertainment' | 'transportation'
  | 'professional_service' | 'other_expense' | 'medical'
  | 'education' | 'life_insurance' | 'house_rent' | 'family_living';

export interface LedgerEntry {
  entry_id: string;
  company_id: string;
  project_id?: string;
  entity_type: EntityType;
  type: EntryType;
  category: LedgerCategory;
  description: string;
  amount_untaxed: number;
  tax_amount: number;
  amount_taxed: number;
  tax_rate: number;
  is_tax_exempt: boolean;
  invoice?: {
    invoice_no: string;
    invoice_type: 'two_copy' | 'three_copy' | 'electronic' | 'receipt';
    buyer_name?: string;
    buyer_tax_id?: string;
  };
  counterparty_name?: string;
  counterparty_tax_id?: string;
  payment_method?: 'cash' | 'bank_transfer' | 'check' | 'credit_card';
  transaction_date: string;
  period: string;
  created_at: string;
  created_by: string;
  is_deductible?: boolean;
  notes?: string;
}

// ════════════════════════════════════════════════════════════════
// § 4  Guardian — 保險型別
// ════════════════════════════════════════════════════════════════

export type PolicyCategory =
  | 'car_insurance' | 'pli' | 'workers_comp' | 'employers_liability'
  | 'equipment' | 'professional_liability'
  | 'life_term' | 'life_whole' | 'accident' | 'medical'
  | 'critical_illness' | 'disability' | 'cancer'
  | 'fire' | 'earthquake' | 'vehicle' | 'travel'
  | 'volunteer_group' | 'uav_hull' | 'uav_tpl'
  | 'other';

export type PolicyStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export interface InsurancePolicy {
  policy_id: string;
  entity_type: EntityType;
  category: PolicyCategory;
  insurer: string;
  policy_no_masked: string;
  insured_name: string;
  beneficiary?: string;
  sum_insured: number;
  annual_premium: number;
  payment_frequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
  start_date: string;
  end_date: string;
  is_mandatory: boolean;
  status: PolicyStatus;
  project_id?: string;
  project_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  ledger_linked: boolean;
}

// ════════════════════════════════════════════════════════════════
// § 5  Finance — 貸款型別
// ════════════════════════════════════════════════════════════════

export type LoanCategory =
  | 'mortgage' | 'car_loan' | 'business_loan' | 'credit_line'
  | 'equipment_loan' | 'micro_loan' | 'student_loan'
  | 'personal_loan' | 'policy_loan' | 'other';

export type LoanStatus = 'active' | 'paid_off' | 'defaulted' | 'restructured';

export type RepaymentMethod = 'equal_payment' | 'equal_principal' | 'interest_only' | 'balloon';

export interface LoanRecord {
  loan_id: string;
  entity_type: EntityType;
  category: LoanCategory;
  bank: string;
  loan_name?: string;
  principal: number;
  outstanding_balance: number;
  annual_rate: number;
  loan_months: number;
  remaining_months: number;
  monthly_payment: number;
  repayment_method: RepaymentMethod;
  start_date: string;
  end_date: string;
  status: LoanStatus;
  collateral?: string;
  grace_period_months?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  ledger_linked: boolean;
}

// ════════════════════════════════════════════════════════════════
// § 6  Scout — UAV 任務型別
// ════════════════════════════════════════════════════════════════

export type MissionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'aborted';
export type MissionType = 'aerial_photo' | 'inspection' | 'agriculture' | 'survey' | 'rescue_support' | 'other';

export interface FlightMission {
  mission_id: string;
  entity_type: 'co_drone';
  mission_type: MissionType;
  title: string;
  client_name: string;
  location: string;
  latitude?: number;
  longitude?: number;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string;
  actual_end?: string;
  pilot_id: string;
  equipment_ids: string[];
  status: MissionStatus;
  service_fee?: number;
  flight_time_mins?: number;
  area_covered_sqm?: number;
  weather_condition?: string;
  permit_no?: string;
  permit_obtained: boolean;
  rescue_mission_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════════════════════════════════
// § 7  Lex — 合約型別
// ════════════════════════════════════════════════════════════════

export type ContractType = 'owner' | 'subcontract' | 'design' | 'service' | 'purchase' | 'lease' | 'nda' | 'other';
export type ContractStatus = 'draft' | 'review' | 'active' | 'completed' | 'disputed' | 'terminated';

export interface PaymentMilestone {
  milestone_id: string;
  label: string;
  due_date: string;
  amount: number;
  percentage?: number;
  is_paid: boolean;
  paid_date?: string;
}

export interface Contract {
  contract_id: string;
  entity_type: EntityType;
  contract_type: ContractType;
  title: string;
  counterparty: string;
  counterparty_tax_id?: string;
  total_amount: number;
  currency: 'NTD' | 'USD' | 'other';
  sign_date: string;
  effective_date: string;
  expiry_date?: string;
  status: ContractStatus;
  milestones: PaymentMilestone[];
  warranty_months?: number;
  liability_cap?: number;
  penalty_clause?: string;
  project_id?: string;
  related_contract_id?: string;
  file_ref?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════════════════════════════════
// § 8  Zora — 公益法人型別
// ════════════════════════════════════════════════════════════════

export type DonationMethod = 'bank_transfer' | 'cash' | 'check' | 'online' | 'other';
export type DonationType = 'one_time' | 'recurring';

export interface DonationRecord {
  donation_id: string;
  donor_name: string;
  donor_id_no?: string;
  donor_email?: string;
  donor_address?: string;
  amount: number;
  donation_type: DonationType;
  payment_method: DonationMethod;
  purpose?: string;
  project_id?: string;
  receipt_issued: boolean;
  receipt_no?: string;
  donation_date: string;
  tax_deductible: boolean;
  notes?: string;
  created_at: string;
}

// ════════════════════════════════════════════════════════════════
// § 9  Reconciliation（C-1d Accountant ↔ Finance 對帳）
// ════════════════════════════════════════════════════════════════

export type ReconciliationStatus =
  | 'MATCHED'            // 帳本 ↔ 貸款完全吻合
  | 'DISCREPANCY'        // 存在差異
  | 'MISSING_LEDGER'     // 帳本缺少此筆貸款月繳
  | 'MISSING_LOAN'       // 貸款庫缺少此筆帳本支出
  | 'AMOUNT_MISMATCH';   // 金額不一致

export interface ReconciliationItem {
  /** 匹配鍵（通常是 bank + category） */
  match_key: string;
  status: ReconciliationStatus;
  /** 帳本端金額 */
  ledger_amount?: number;
  /** 貸款端月繳金額 */
  loan_amount?: number;
  /** 差異金額 */
  delta: number;
  /** 相關帳本 entry ID */
  ledger_entry_id?: string;
  /** 相關貸款 ID */
  loan_id?: string;
  /** 描述 */
  description: string;
}

export interface ReconciliationReport {
  /** 對帳期間 */
  period: string;
  /** 法人實體（可選，null = 全實體）*/
  entity_type?: EntityType;
  /** 對帳執行時間 */
  executed_at: string;
  /** 整體狀態 */
  overall_status: 'MATCHED' | 'DISCREPANCY';
  /** 帳本端月繳合計 */
  ledger_total: number;
  /** 貸款端月繳合計 */
  loan_total: number;
  /** 差異合計 */
  total_delta: number;
  /** 明細 */
  items: ReconciliationItem[];
  /** 建議行動 */
  action_items: Array<{
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    action: string;
  }>;
}

// ════════════════════════════════════════════════════════════════
// § 10  Write Request Queue 型別（提升至 shared）
// ════════════════════════════════════════════════════════════════

export type WriteRequestStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'RETRYING'
  | 'DEAD_LETTER'
  | 'ALREADY_PROCESSED';

export interface WriteRequest {
  request_id: string;
  source_agent: string;
  target_agent: string;
  collection: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  idempotency_key: string;
  reason: string;
  entity_type?: string;
  status: WriteRequestStatus;
  retry_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
  delivered_at?: string;
}

export interface WriteRequestResult {
  ok: boolean;
  request_id: string;
  status: WriteRequestStatus;
  message: string;
}
