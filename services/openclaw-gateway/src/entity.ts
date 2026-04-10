/**
 * entity.ts — 全域法人實體定義 v2.0
 *
 * 涵蓋 XXT-AGENT 生態的所有法人與自然人實體：
 *   P1 個人 / P2 家庭
 *   C1 無人機公司 / C2 小型營建公司 / C3 室內裝修公司 / C4 室內設計公司
 *   A1 全國性社團法人救難協會（非營利）
 *
 * 此檔案為整個 monorepo 的「實體定義單一來源（Single Source of Truth）」
 * 所有 Agent 路由、Store、API 均應引用此 EntityType
 */
// ── M-09: 從共享 types 匯入核心實體型別（SSOT）───────────────────
import type { EntityType } from '@xxt-agent/types';
export type { EntityType };

// 匯出共享常量的本地別名
export { ALL_ENTITY_TYPES as ALL_ENTITIES_SHARED } from '@xxt-agent/types';
// 注意：EntityType 型別定義已遷移至 @xxt-agent/types/src/index.ts (SSOT)

/** 法人性質分類 */
export type LegalType =
  | 'individual'          // 自然人
  | 'limited_co'          // 有限公司
  | 'corporation'         // 股份有限公司
  | 'nonprofit';          // 社團法人/財團法人（非營利）

/** 會計制度 */
export type AccountingMethod =
  | 'cash'                          // 現金基礎（個人/家庭）
  | 'accrual'                       // 應計基礎（一般公司）
  | 'percentage_of_completion'      // 完工比例法（工程業 C2/C3）
  | 'fund_accounting';              // 基金會計（非營利 A1）

/** 完整的實體配置（Entity Profile）*/
export interface EntityProfile {
  entity_id:         EntityType;
  label_zh:          string;          // 顯示名稱（中文）
  label_en:          string;          // 顯示名稱（英文）
  legal_type:        LegalType;
  accounting_method: AccountingMethod;
  tax_id?:           string;          // 統一編號（加密儲存）
  fiscal_year_end:   string;          // MMDD，台灣一般 '1231'
  industry_code?:    string;          // 行業標準分類代碼
  color_hex:         string;          // 實體代表色（Dashboard 用）
  is_active:         boolean;
}

// ── 實體配置表 ────────────────────────────────────────────────────────

/** 所有實體的配置，可在 Dashboard / Report 中動態讀取 */
export const ENTITY_PROFILES: Record<EntityType, EntityProfile> = {
  personal: {
    entity_id: 'personal',
    label_zh: '個人',
    label_en: 'Personal',
    legal_type: 'individual',
    accounting_method: 'cash',
    fiscal_year_end: '1231',
    color_hex: '#6366F1',
    is_active: true,
  },
  family: {
    entity_id: 'family',
    label_zh: '家庭',
    label_en: 'Family',
    legal_type: 'individual',
    accounting_method: 'cash',
    fiscal_year_end: '1231',
    color_hex: '#EC4899',
    is_active: true,
  },
  co_drone: {
    entity_id: 'co_drone',
    label_zh: '無人機公司',
    label_en: 'Drone Co.',
    legal_type: 'limited_co',
    accounting_method: 'accrual',
    fiscal_year_end: '1231',
    industry_code: '7294',  // 航空攝影及其他航空服務業
    color_hex: '#708090',
    is_active: true,
  },
  co_construction: {
    entity_id: 'co_construction',
    label_zh: '小型營建公司',
    label_en: 'Construction Co.',
    legal_type: 'limited_co',
    accounting_method: 'percentage_of_completion',
    fiscal_year_end: '1231',
    industry_code: '4100',  // 建築工程業
    color_hex: '#D97706',
    is_active: true,
  },
  co_renovation: {
    entity_id: 'co_renovation',
    label_zh: '室內裝修公司',
    label_en: 'Renovation Co.',
    legal_type: 'limited_co',
    accounting_method: 'percentage_of_completion',
    fiscal_year_end: '1231',
    industry_code: '4390',  // 其他專門營建業（裝修）
    color_hex: '#A3684A',
    is_active: true,
  },
  co_design: {
    entity_id: 'co_design',
    label_zh: '室內設計公司',
    label_en: 'Design Co.',
    legal_type: 'limited_co',
    accounting_method: 'accrual',
    fiscal_year_end: '1231',
    industry_code: '7421',  // 室內設計業
    color_hex: '#D4A853',
    is_active: true,
  },
  assoc_rescue: {
    entity_id: 'assoc_rescue',
    label_zh: '全國性社團法人救難協會',
    label_en: 'National Rescue Association',
    legal_type: 'nonprofit',
    accounting_method: 'fund_accounting',
    fiscal_year_end: '1231',
    industry_code: '9490',  // 其他社會服務業
    color_hex: '#4D7C5F',
    is_active: true,
  },
};

// ── 工具函數 ──────────────────────────────────────────────────────────

/** 取得實體中文標示 */
export function entityLabel(e: EntityType): string {
  return ENTITY_PROFILES[e]?.label_zh ?? e;
}

/** 取得實體中文標示（短版，用於報表列表） */
export function entityShortLabel(e: EntityType): string {
  const map: Record<EntityType, string> = {
    personal:         '個人',
    family:           '家庭',
    co_drone:         '無人機',
    co_construction:  '營建',
    co_renovation:    '裝修',
    co_design:        '設計',
    assoc_rescue:     '救難協會',
  };
  return map[e] ?? e;
}

/** 判斷是否為公司類型 */
export function isCompanyEntity(e: EntityType): boolean {
  return e.startsWith('co_');
}

/** 判斷是否為非營利法人 */
export function isNonprofitEntity(e: EntityType): boolean {
  return e.startsWith('assoc_');
}

/** 判斷是否為個人/家庭（非法人） */
export function isPersonalEntity(e: EntityType): boolean {
  return e === 'personal' || e === 'family';
}

/** 取得實體適用的會計制度 */
export function getAccountingMethod(e: EntityType): AccountingMethod {
  return ENTITY_PROFILES[e]?.accounting_method ?? 'accrual';
}

/** 工程業實體列表（使用完工比例法）*/
export const CONSTRUCTION_ENTITIES: EntityType[] = ['co_construction', 'co_renovation'];

/** 所有公司實體 */
export const ALL_COMPANY_ENTITIES: EntityType[] = [
  'co_drone', 'co_construction', 'co_renovation', 'co_design',
];

/** 所有實體（含個人/家庭/非營利）*/
export const ALL_ENTITIES: EntityType[] = [
  'personal', 'family',
  'co_drone', 'co_construction', 'co_renovation', 'co_design',
  'assoc_rescue',
];

// ── 舊版相容 ──────────────────────────────────────────────────────────
/**
 * @deprecated 使用新版 EntityType（7個實體）。
 * 舊版 'company' 已拆分為 co_drone / co_construction / co_renovation / co_design。
 * 此型別保留供舊資料遷移轉換使用。
 */
export type LegacyEntityType = 'company' | 'personal' | 'family';

/**
 * 將舊版 'company' entity_type 轉換為最合適的新版實體
 * （遷移腳本使用，正式程式碼不應調用此函數）
 */
export function migrateLegacyEntity(
  legacy: LegacyEntityType,
  hint?: string,
): EntityType {
  if (legacy === 'personal') return 'personal';
  if (legacy === 'family') return 'family';
  // 'company' → 根據 hint（description/category）判斷
  if (hint) {
    const h = hint.toLowerCase();
    if (h.includes('無人機') || h.includes('uav') || h.includes('飛') || h.includes('空拍')) return 'co_drone';
    if (h.includes('裝修') || h.includes('裝潢')) return 'co_renovation';
    if (h.includes('設計') || h.includes('design')) return 'co_design';
    if (h.includes('建築') || h.includes('工程') || h.includes('營建')) return 'co_construction';
    if (h.includes('協會') || h.includes('救難') || h.includes('公益')) return 'assoc_rescue';
  }
  return 'co_construction'; // 預設遷移至營建（主業）
}
