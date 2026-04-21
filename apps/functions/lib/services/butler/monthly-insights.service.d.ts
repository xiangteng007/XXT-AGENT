/**
 * Monthly Insights Service
 *
 * Generates AI-powered cross-domain monthly insights by analyzing
 * finance + health + schedule data to find patterns and provide advice.
 */
export interface MonthlyInsight {
    month: string;
    generatedAt: Date;
    sections: InsightSection[];
    summary: string;
}
interface InsightSection {
    title: string;
    icon: string;
    items: string[];
    severity: 'info' | 'warning' | 'success';
}
/**
 * Generate monthly cross-domain insights for a user
 */
export declare function generateMonthlyInsights(uid: string, month?: string): Promise<MonthlyInsight>;
export {};
//# sourceMappingURL=monthly-insights.service.d.ts.map