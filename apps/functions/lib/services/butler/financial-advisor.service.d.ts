/**
 * Financial Advisor Service
 *
 * AI-powered comprehensive financial advisory leveraging Gemini.
 * Integrates data from all financial domains (spending, investments, loans, tax)
 * to generate personalized, actionable advice.
 */
export type AdvisoryTopic = 'portfolio_review' | 'debt_strategy' | 'tax_optimization' | 'retirement_planning' | 'emergency_fund' | 'comprehensive';
export declare class FinancialAdvisorService {
    /**
     * Generate comprehensive financial advice
     */
    getFinancialAdvice(uid: string, topic?: AdvisoryTopic): Promise<FinancialAdviceReport>;
    /**
     * Calculate financial health score (0-100)
     */
    private calculateHealthScore;
    /**
     * Estimate retirement readiness
     */
    private estimateRetirement;
    /**
     * Generate priority action items
     */
    private generateActionItems;
    /**
     * Generate executive summary
     */
    private generateSummary;
    /**
     * Format advice as LINE-friendly text
     */
    formatForLine(report: FinancialAdviceReport): string;
}
export interface FinancialAdviceReport {
    topic: AdvisoryTopic;
    generatedAt: string;
    sections: AdviceSection[];
    actionItems: string[];
    summary: string;
}
export interface AdviceSection {
    title: string;
    score?: number;
    items: string[];
}
export declare const financialAdvisorService: FinancialAdvisorService;
//# sourceMappingURL=financial-advisor.service.d.ts.map