/**
 * Butler Data Service
 *
 * Aggregates user personal data from Firestore subcollections
 * to enrich AI context for personalized responses.
 *
 * Collections layout:
 *   users/{userId}/health_records
 *   users/{userId}/finance_transactions
 *   users/{userId}/vehicle_records
 *   users/{userId}/calendar_events
 *   users/{userId}/butler_preferences
 */
export interface ButlerContext {
    health?: HealthSummary;
    finance?: FinanceSummary;
    vehicle?: VehicleSummary;
    calendar?: CalendarSummary;
    preferences?: UserPreferences;
}
interface HealthSummary {
    latestWeight?: number;
    latestSteps?: number;
    latestSleepHours?: number;
    weeklyExerciseMinutes?: number;
    lastUpdated?: string;
}
interface FinanceSummary {
    monthlySpending?: number;
    topCategories?: Array<{
        category: string;
        amount: number;
    }>;
    unprocessedBills?: number;
    lastUpdated?: string;
}
interface VehicleSummary {
    currentMileage?: number;
    lastFuelEfficiency?: number;
    nextMaintenanceDate?: string;
    lastUpdated?: string;
}
interface CalendarSummary {
    todayEvents?: Array<{
        title: string;
        time: string;
    }>;
    upcomingCount?: number;
    lastUpdated?: string;
}
interface UserPreferences {
    language?: string;
    timezone?: string;
    aiModel?: string;
    notificationEnabled?: boolean;
}
/**
 * Fetch aggregated user data from Firestore for AI context
 */
export declare function getButlerContext(userId: string): Promise<ButlerContext>;
export {};
//# sourceMappingURL=butler-data.service.d.ts.map