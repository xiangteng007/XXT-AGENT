/**
 * Tax Estimation Service (Taiwan 2025/2026)
 *
 * Provides Taiwan income tax estimation, dividend tax optimization,
 * deduction analysis, and tax-saving recommendations.
 *
 * Based on: 所得稅法、所得基本稅額條例
 */
import { TaxProfile } from '../../types/butler.types';
export declare class TaxService {
    /**
     * Save/update tax profile
     */
    setTaxProfile(uid: string, profile: TaxProfile): Promise<void>;
    /**
     * Get tax profile
     */
    getTaxProfile(uid: string, year?: number): Promise<TaxProfile | null>;
    /**
     * Estimate income tax
     */
    estimateIncomeTax(profile: TaxProfile): TaxEstimation;
    /**
     * Calculate progressive tax
     */
    private calculateProgressiveTax;
    /**
     * Compare dividend tax methods: 合併計稅 vs 分離課稅 28%
     */
    compareDividendTaxMethod(dividendIncome: number, totalTaxableIncome: number): DividendTaxAnalysis;
    /**
     * Generate tax-saving tips
     */
    getTaxSavingTips(profile: TaxProfile, estimation: TaxEstimation): string[];
}
export interface TaxEstimation {
    year: number;
    grossIncome: number;
    exemptions: number;
    deductionUsed: number;
    deductionMethod: 'standard' | 'itemized';
    specialDeductions: number;
    taxableIncome: number;
    taxBracketRate: number;
    estimatedTax: number;
    effectiveRate: number;
    dividendAnalysis?: DividendTaxAnalysis;
    breakdown: {
        salary: number;
        business: number;
        investment: number;
        rental: number;
        other: number;
    };
}
export interface DividendTaxAnalysis {
    dividendIncome: number;
    combinedTax: number;
    combinedCredit: number;
    separateTax: number;
    separateRate: number;
    recommendedMethod: 'combined' | 'separate';
    savingsAmount: number;
}
export declare const taxService: TaxService;
//# sourceMappingURL=tax.service.d.ts.map