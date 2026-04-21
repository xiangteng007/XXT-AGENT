/**
 * Butler Weekly Digest Service
 *
 * Generates a cross-domain weekly summary pushed to the user
 * every Sunday at 20:00 via LINE/Telegram.
 *
 * Aggregates data from:
 *   - Finance: weekly spending vs previous week
 *   - Health: avg steps, weight trend, exercise minutes
 *   - Vehicle: fuel logs, maintenance reminders
 *   - Schedule: completed vs total events
 *
 * Also generates AI-powered cross-domain insights.
 */
interface WeeklyDigest {
    weekStart: string;
    weekEnd: string;
    finance: {
        totalExpense: number;
        totalIncome: number;
        netSavings: number;
        topCategories: Array<{
            category: string;
            amount: number;
        }>;
        vsLastWeek: number;
    };
    health: {
        avgSteps: number;
        avgSleepHours: number;
        totalExerciseMinutes: number;
        weightChange: number;
        latestWeight?: number;
    };
    vehicle: {
        fuelLogs: number;
        totalFuelCost: number;
        avgKmPerLiter?: number;
        urgentReminders: number;
    };
    schedule: {
        totalEvents: number;
        completedEvents: number;
        busiestDay: string;
    };
    insights: string[];
}
export declare function generateWeeklyDigest(userId: string): Promise<WeeklyDigest>;
export declare function formatDigestMessage(digest: WeeklyDigest): string;
export declare function sendWeeklyDigests(): Promise<{
    sent: number;
    errors: string[];
}>;
export {};
//# sourceMappingURL=weekly-digest.service.d.ts.map