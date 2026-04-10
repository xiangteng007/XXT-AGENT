/**
 * Shared Types for XXT-AGENT Monorepo
 */

// OpenClaw Contracts (PR-1)
export * from "./openclaw";

// ── EntityType（v6.0 — 7 實體單一來源）────────────────────────

/** 全域法人實體識別碼（與 gateway/src/entity.ts 保持同步）*/
export type EntityType =
  | 'personal'           // P1：個人
  | 'family'             // P2：家庭
  | 'co_drone'           // C1：無人機公司
  | 'co_construction'    // C2：小型營建公司
  | 'co_renovation'      // C3：室內裝修公司
  | 'co_design'          // C4：室內設計公司
  | 'assoc_rescue';      // A1：全國性社團法人救難協會

/** 所有合法的 EntityType 值（Runtime 驗證用）*/
export const ALL_ENTITY_TYPES: EntityType[] = [
  'personal', 'family',
  'co_drone', 'co_construction', 'co_renovation', 'co_design',
  'assoc_rescue',
];

/** 所有公司實體 */
export const COMPANY_ENTITY_TYPES: EntityType[] = [
  'co_drone', 'co_construction', 'co_renovation', 'co_design',
];

// ── User & Auth Types ─────────────────────────────────────────

export interface User {
    uid: string;
    email: string;
    role: 'owner' | 'admin' | 'viewer';
    tenantId?: string;
}

// Butler Types
export interface HealthRecord {
    id: string;
    userId: string;
    date: string;
    metrics: Record<string, number>;
}

export interface FinanceRecord {
    id: string;
    userId: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    date: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: 'appointment' | 'reminder' | 'task';
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
