/**
 * Service Interfaces (V3 Audit #5)
 *
 * Defines contracts for butler service implementations.
 * Enables dependency injection and testability.
 */
export interface IHealthService {
    getProfile(uid: string): Promise<unknown>;
    updateProfile(uid: string, data: unknown): Promise<void>;
    getMetrics(uid: string, period: string): Promise<unknown>;
    syncAppleHealth(uid: string, data: unknown): Promise<unknown>;
}
export interface IFinanceService {
    getProfile(uid: string): Promise<unknown>;
    getTransactions(uid: string, query?: TransactionQuery): Promise<unknown[]>;
    addTransaction(uid: string, data: unknown): Promise<string>;
    getMonthlySummary(uid: string, year: number, month: number): Promise<unknown>;
    getBudgetStatus(uid: string): Promise<unknown>;
}
export interface IVehicleService {
    getProfile(uid: string): Promise<unknown>;
    addRecord(uid: string, data: unknown): Promise<string>;
    getMaintenanceSchedule(uid: string): Promise<unknown>;
    getFuelHistory(uid: string, limit?: number): Promise<unknown[]>;
}
export interface IScheduleService {
    getTodaySchedule(uid: string): Promise<unknown>;
    getUpcoming(uid: string, days?: number): Promise<unknown[]>;
    syncGoogleCalendar(uid: string): Promise<unknown>;
}
export interface IButlerAIService {
    generateResponse(message: string, userId?: string, context?: unknown): Promise<string>;
    analyzeIntent(message: string): Promise<{
        intent: string;
        confidence: number;
    }>;
}
export interface TransactionQuery {
    startDate?: string;
    endDate?: string;
    category?: string;
    type?: 'income' | 'expense';
    limit?: number;
    offset?: number;
}
//# sourceMappingURL=service-interfaces.d.ts.map