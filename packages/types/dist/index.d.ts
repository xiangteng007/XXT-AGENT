/**
 * Shared Types for XXT-AGENT Monorepo
 */
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