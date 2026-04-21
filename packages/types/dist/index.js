/**
 * Shared Types for XXT-AGENT Monorepo
 */
// OpenClaw Contracts (PR-1)
export * from "./openclaw";
// Agent Types (B-4 — v8.0 型別共享)
export * from "./agents";
// Investment Brain Schema Contract (P2-01)
export * from "./investment-brain";
/** 所有合法的 EntityType 值（Runtime 驗證用）*/
export const ALL_ENTITY_TYPES = [
    'personal', 'family',
    'co_drone', 'co_construction', 'co_renovation', 'co_design',
    'assoc_rescue',
];
/** 所有公司實體 */
export const COMPANY_ENTITY_TYPES = [
    'co_drone', 'co_construction', 'co_renovation', 'co_design',
];
