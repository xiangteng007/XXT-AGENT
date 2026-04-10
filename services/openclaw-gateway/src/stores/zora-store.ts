/**
 * ZoraStore — 公益法人管家持久化儲存層 (C-03)
 *
 * ◆ 安全等級：CRITICAL
 *
 * 本 Store 管理全國性社團法人救難協會 (assoc_rescue) 的四種核心實體：
 *   1. DonationRecord  — 捐款紀錄（含捐款者個資：姓名、身分證末四碼、地址、Email）
 *   2. VolunteerProfile — 志工檔案（含聯絡方式、緊急聯絡人）
 *   3. GrantProject     — 政府補助專案
 *   4. RescueMission    — 救難任務出勤記錄
 *
 * 設計決策（Opus Thinking 審議記錄）：
 *
 *   Q1: 哪些欄位需要 AES-256-GCM 加密？
 *   A1: 捐款者的 donor_name, donor_id_no, donor_email, donor_address 都屬
 *       CRITICAL 隱私等級（依《個人資料保護法》第 6 條與協會自律）。
 *       志工的 contact, emergency_contact 屬 PRIVATE 等級。
 *       → 共 6 個欄位需要在 Firestore 層面自動加密。
 *
 *   Q2: 為什麼不直接加密整個 Document？
 *   A2: Firestore 的查詢功能依賴明文欄位的可索引性。我們只加密「無需被查詢」
 *       的個資欄位，保留 donation_date, amount, project_id 等可索引欄位。
 *
 *   Q3: Memory 快取中的資料是明文嗎？
 *   A3: 是的。processFromStorage() 會解密回明文存入記憶體陣列。
 *       這是安全與效能的取捨——記憶體陣列生存期等同容器生命週期，
 *       且 Gateway 運行在內網（不暴露外網）。真正的風險在 Firestore
 *       持久層，因此加密只針對持久層。
 *
 * @module ZoraStore
 * @since v6.0
 */

import { BaseAgentStore } from '../base-agent-store';

// ════════════════════════════════════════════════════════════════
// 型別定義（與 zora.ts route 中的型別一致，但以 `id` 取代各自的 *_id）
// ════════════════════════════════════════════════════════════════

export type DonationMethod = 'bank_transfer' | 'cash' | 'check' | 'online' | 'other';
export type DonationType   = 'one_time' | 'recurring';

/**
 * 捐款紀錄 — CRITICAL 隱私等級
 *
 * 加密欄位：donor_name, donor_id_no, donor_email, donor_address
 * 這些欄位在寫入 Firestore 時自動經 AES-256-GCM 加密，
 * 從 Firestore 讀取時自動解密回明文。
 */
export interface ZoraDonation {
  id: string;                     // BaseAgentStore 要求 (原 donation_id)
  entity_type?: 'assoc_rescue';   // 固定歸屬救難協會

  // ── CRITICAL 加密欄位 ──────────────────────────────────
  donor_name:      string;
  donor_id_no?:    string;        // 身分證後 4 碼（收據用）
  donor_email?:    string;
  donor_address?:  string;        // 收據郵寄用

  // ── 非加密欄位（可索引/可查詢）──────────────────────────
  amount:          number;        // NT$
  donation_type:   DonationType;
  payment_method:  DonationMethod;
  purpose?:        string;
  project_id?:     string;
  receipt_issued:  boolean;
  receipt_no?:     string;
  donation_date:   string;        // YYYY-MM-DD
  tax_deductible:  boolean;
  notes?:          string;
  created_at:      string;
}

/**
 * 志工檔案 — PRIVATE 隱私等級
 *
 * 加密欄位：contact, emergency_contact
 */
export interface ZoraVolunteer {
  id: string;
  entity_type?: 'assoc_rescue';

  name:              string;
  id_no_masked:      string;     // 後四碼
  birth_date?:       string;

  // ── PRIVATE 加密欄位 ───────────────────────────────────
  contact:           string;
  emergency_contact?: string;

  // ── 非加密欄位 ─────────────────────────────────────────
  join_date:          string;
  skills:             string[];
  total_service_hrs:  number;
  is_active:          boolean;
  insurance_enrolled: boolean;
  notes?:             string;
  created_at:         string;
}

/**
 * 志工服務時數紀錄 — 無加密需求
 */
export interface ZoraServiceRecord {
  id: string;
  entity_type?: 'assoc_rescue';
  volunteer_id: string;
  date:         string;
  hours:        number;
  activity:     string;
  notes?:       string;
  created_at:   string;
}

/**
 * 政府補助專案 — 無加密需求（公開資訊）
 */
export interface ZoraGrantProject {
  id: string;
  entity_type?: 'assoc_rescue';
  title:         string;
  grant_source:  string;          // 補助機關
  grant_amount:  number;          // NT$
  co_funding?:   number;          // 自籌款
  start_date:    string;
  end_date:      string;
  status:        'planning' | 'active' | 'reporting' | 'completed' | 'rejected';
  spent_amount:  number;
  expenses:      ZoraGrantExpense[];
  notes?:        string;
  created_at:    string;
}

export interface ZoraGrantExpense {
  expense_id:  string;
  date:        string;
  amount:      number;
  description: string;
  receipt_no:  string;
}

export type MissionStatus = 'standby' | 'mobilized' | 'active' | 'completed' | 'debrief';

/**
 * 救難任務 — 無加密需求（出勤紀錄屬組織公開資訊）
 */
export interface ZoraRescueMission {
  id: string;
  entity_type?: 'assoc_rescue';
  title:           string;
  mission_type:    'search_and_rescue' | 'disaster_relief' | 'training' | 'support';
  location:        string;
  initiated_by:    string;
  start_time:      string;
  end_time?:       string;
  status:          MissionStatus;
  volunteer_ids:   string[];
  equipment_used:  string[];
  uav_requested:   boolean;
  uav_mission_id?: string;
  outcome?:        string;
  report_filed:    boolean;
  created_at:      string;
}

// ════════════════════════════════════════════════════════════════
// Store 實作
// ════════════════════════════════════════════════════════════════

/**
 * 捐款 Store — CRITICAL
 *
 * 四個個資欄位在 Firestore 層自動 AES-256-GCM 加密。
 * 記憶體快取保存明文（容器生命週期內有效）。
 */
export class DonationStore extends BaseAgentStore<ZoraDonation> {
  constructor() {
    super({
      collectionName:  'zora_donations',
      maxMemoryItems:  2000,
      encryptedFields: [
        'donor_name',       // CRITICAL — 姓名
        'donor_id_no',      // CRITICAL — 身分證後四碼
        'donor_email',      // CRITICAL — Email
        'donor_address',    // CRITICAL — 郵寄地址
      ],
    });
  }
}

/**
 * 志工 Store — PRIVATE
 *
 * 聯絡方式與緊急聯絡人在 Firestore 層加密。
 */
export class VolunteerStore extends BaseAgentStore<ZoraVolunteer> {
  constructor() {
    super({
      collectionName:  'zora_volunteers',
      maxMemoryItems:  500,
      encryptedFields: [
        'contact',            // PRIVATE — 聯絡電話
        'emergency_contact',  // PRIVATE — 緊急聯絡人
      ],
    });
  }
}

/**
 * 志工服務時數 Store — 無加密
 */
export class ServiceRecordStore extends BaseAgentStore<ZoraServiceRecord> {
  constructor() {
    super({
      collectionName:  'zora_service_records',
      maxMemoryItems:  5000,
    });
  }
}

/**
 * 政府補助專案 Store — 無加密
 */
export class GrantProjectStore extends BaseAgentStore<ZoraGrantProject> {
  constructor() {
    super({
      collectionName:  'zora_grant_projects',
      maxMemoryItems:  200,
    });
  }
}

/**
 * 救難任務 Store — 無加密
 */
export class RescueMissionStore extends BaseAgentStore<ZoraRescueMission> {
  constructor() {
    super({
      collectionName:  'zora_rescue_missions',
      maxMemoryItems:  1000,
    });
  }
}

// ════════════════════════════════════════════════════════════════
// 全域 Singleton 匯出
// ════════════════════════════════════════════════════════════════

export const donationStore      = new DonationStore();
export const volunteerStore     = new VolunteerStore();
export const serviceRecordStore = new ServiceRecordStore();
export const grantProjectStore  = new GrantProjectStore();
export const rescueMissionStore = new RescueMissionStore();
