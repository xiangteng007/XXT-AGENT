/**
 * Shared Types for XXT-AGENT Monorepo
 */
export * from "./openclaw";
export * from "./agents";
export * from "./investment-brain";
/** 全域法人實體識別碼（與 gateway/src/entity.ts 保持同步）*/
export type EntityType = 'personal' | 'family' | 'co_drone' | 'co_construction' | 'co_renovation' | 'co_design' | 'assoc_rescue';
/** 所有合法的 EntityType 值（Runtime 驗證用）*/
export declare const ALL_ENTITY_TYPES: EntityType[];
/** 所有公司實體 */
export declare const COMPANY_ENTITY_TYPES: EntityType[];
export interface User {
    uid: string;
    email: string;
    role: 'owner' | 'admin' | 'viewer';
    tenantId?: string;
}
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
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
//# sourceMappingURL=index.d.ts.map