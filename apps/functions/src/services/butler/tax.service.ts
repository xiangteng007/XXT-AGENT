/**
 * Tax Estimation Service (Taiwan 2025/2026)
 *
 * Provides Taiwan income tax estimation, dividend tax optimization,
 * deduction analysis, and tax-saving recommendations.
 *
 * Based on: 所得稅法、所得基本稅額條例
 */

import * as admin from 'firebase-admin';
import { TaxProfile } from '../../types/butler.types';
// TaxDeduction interface used only in the type definition

const db = admin.firestore();

// ================================
// Taiwan Tax Constants (2025/2026)
// ================================

// 綜所稅免稅額
const EXEMPTION_AMOUNT = 97_000; // 每人免稅額

// 標準扣除額
const STANDARD_DEDUCTION_SINGLE = 131_000;
const STANDARD_DEDUCTION_MARRIED = 262_000;

// 薪資所得特別扣除額
const SALARY_SPECIAL_DEDUCTION = 218_000;

// 特別扣除額上限
const DISABILITY_DEDUCTION = 218_000;
const EDUCATION_DEDUCTION = 25_000; // per dependent
const CHILDCARE_DEDUCTION = 120_000; // per child under 5
const ELDERLY_CARE_DEDUCTION = 120_000;

// 股利所得
const DIVIDEND_CREDIT_RATE = 0.085; // 合併計稅抵減率 8.5%
const DIVIDEND_CREDIT_CAP = 80_000; // 抵減上限 8 萬
const DIVIDEND_SEPARATE_RATE = 0.28; // 分離課稅 28%

// 綜所稅級距
const TAX_BRACKETS = [
    { min: 0, max: 590_000, rate: 0.05 },
    { min: 590_001, max: 1_330_000, rate: 0.12 },
    { min: 1_330_001, max: 2_660_000, rate: 0.20 },
    { min: 2_660_001, max: 4_980_000, rate: 0.30 },
    { min: 4_980_001, max: Infinity, rate: 0.40 },
];

// 累進差額
const PROGRESSIVE_DIFFERENCE = [0, 41_300, 147_700, 413_700, 911_700];

export class TaxService {
    /**
     * Save/update tax profile
     */
    async setTaxProfile(uid: string, profile: TaxProfile): Promise<void> {
        await db.doc(`users/${uid}/butler/finance/tax/${profile.year}`).set(profile, { merge: true });
    }

    /**
     * Get tax profile
     */
    async getTaxProfile(uid: string, year?: number): Promise<TaxProfile | null> {
        const y = year || new Date().getFullYear();
        const doc = await db.doc(`users/${uid}/butler/finance/tax/${y}`).get();
        return doc.exists ? (doc.data() as TaxProfile) : null;
    }

    /**
     * Estimate income tax
     */
    estimateIncomeTax(profile: TaxProfile): TaxEstimation {
        // 1. 計算綜合所得總額
        const grossIncome = (profile.annualSalary || 0)
            + (profile.businessIncome || 0)
            + (profile.investmentIncome || 0)
            + (profile.rentalIncome || 0)
            + (profile.otherIncome || 0);

        // 2. 免稅額
        const exemptions = EXEMPTION_AMOUNT * (1 + profile.dependents);

        // 3. 扣除額（取標準或列舉較高者）
        const standardDeduction = profile.filingStatus === 'married'
            ? STANDARD_DEDUCTION_MARRIED
            : STANDARD_DEDUCTION_SINGLE;

        const itemizedTotal = profile.deductions.reduce((sum, d) => sum + d.amount, 0);
        const deductionUsed = Math.max(standardDeduction, itemizedTotal);
        const deductionMethod = itemizedTotal > standardDeduction ? 'itemized' : 'standard';

        // 4. 特別扣除額
        let specialDeductions = 0;
        if (profile.annualSalary && profile.annualSalary > 0) {
            specialDeductions += Math.min(profile.annualSalary, SALARY_SPECIAL_DEDUCTION);
        }

        // Check special deductions from profile
        for (const d of profile.deductions) {
            switch (d.type) {
                case 'disability':
                    specialDeductions += DISABILITY_DEDUCTION;
                    break;
                case 'education':
                    specialDeductions += Math.min(d.amount, EDUCATION_DEDUCTION);
                    break;
                case 'childcare':
                    specialDeductions += Math.min(d.amount, CHILDCARE_DEDUCTION);
                    break;
                case 'elderly_care':
                    specialDeductions += Math.min(d.amount, ELDERLY_CARE_DEDUCTION);
                    break;
            }
        }

        // 5. 應稅所得
        const taxableIncome = Math.max(0, grossIncome - exemptions - deductionUsed - specialDeductions);

        // 6. 計算稅額
        const { tax, bracketIndex } = this.calculateProgressiveTax(taxableIncome);

        // 7. 股利所得節稅比較
        const dividendIncome = profile.investmentIncome || 0;
        const dividendAnalysis = dividendIncome > 0
            ? this.compareDividendTaxMethod(dividendIncome, taxableIncome)
            : undefined;

        // 若股利分離計稅更省稅，調整最終稅額
        let finalTax = tax;
        if (dividendAnalysis && dividendAnalysis.recommendedMethod === 'separate') {
            // 從應稅所得中扣除股利收入重算
            const taxWithoutDividend = this.calculateProgressiveTax(
                Math.max(0, taxableIncome - dividendIncome)
            ).tax;
            finalTax = taxWithoutDividend + Math.round(dividendIncome * DIVIDEND_SEPARATE_RATE);
        }

        const effectiveRate = grossIncome > 0 ? Math.round(finalTax / grossIncome * 10000) / 100 : 0;

        return {
            year: profile.year,
            grossIncome,
            exemptions,
            deductionUsed,
            deductionMethod,
            specialDeductions,
            taxableIncome,
            taxBracketRate: TAX_BRACKETS[bracketIndex].rate * 100,
            estimatedTax: Math.round(finalTax),
            effectiveRate,
            dividendAnalysis,
            breakdown: {
                salary: profile.annualSalary || 0,
                business: profile.businessIncome || 0,
                investment: profile.investmentIncome || 0,
                rental: profile.rentalIncome || 0,
                other: profile.otherIncome || 0,
            },
        };
    }

    /**
     * Calculate progressive tax
     */
    private calculateProgressiveTax(taxableIncome: number): { tax: number; bracketIndex: number } {
        let bracketIndex = 0;
        for (let i = TAX_BRACKETS.length - 1; i >= 0; i--) {
            if (taxableIncome > TAX_BRACKETS[i].min) {
                bracketIndex = i;
                break;
            }
        }

        const tax = taxableIncome * TAX_BRACKETS[bracketIndex].rate - PROGRESSIVE_DIFFERENCE[bracketIndex];
        return { tax: Math.max(0, Math.round(tax)), bracketIndex };
    }

    /**
     * Compare dividend tax methods: 合併計稅 vs 分離課稅 28%
     */
    compareDividendTaxMethod(
        dividendIncome: number,
        totalTaxableIncome: number
    ): DividendTaxAnalysis {
        // Method A: 合併計稅（8.5% 抵減，上限 8 萬）
        const creditAmount = Math.min(
            Math.round(dividendIncome * DIVIDEND_CREDIT_RATE),
            DIVIDEND_CREDIT_CAP
        );
        const { tax: combinedTax } = this.calculateProgressiveTax(totalTaxableIncome);
        const methodATax = combinedTax - creditAmount;

        // Method B: 分離課稅 28%
        const separateTax = Math.round(dividendIncome * DIVIDEND_SEPARATE_RATE);
        const { tax: taxWithoutDiv } = this.calculateProgressiveTax(
            Math.max(0, totalTaxableIncome - dividendIncome)
        );
        const methodBTax = taxWithoutDiv + separateTax;

        const recommended = methodATax <= methodBTax ? 'combined' : 'separate';
        const savings = Math.abs(methodATax - methodBTax);

        return {
            dividendIncome,
            combinedTax: methodATax,
            combinedCredit: creditAmount,
            separateTax: methodBTax,
            separateRate: 28,
            recommendedMethod: recommended,
            savingsAmount: savings,
        };
    }

    /**
     * Generate tax-saving tips
     */
    getTaxSavingTips(profile: TaxProfile, estimation: TaxEstimation): string[] {
        const tips: string[] = [];

        // Check deduction method
        if (estimation.deductionMethod === 'standard') {
            tips.push('💡 目前使用標準扣除額。若保費+醫療+房貸利息等列舉項超過 $' +
                (profile.filingStatus === 'married' ? '262,000' : '131,000') + '，可改用列舉扣除省更多');
        }

        // Insurance deduction
        const hasInsurance = profile.deductions.some(d => d.type === 'insurance');
        if (!hasInsurance) {
            tips.push('📌 人身保險費每人每年最高可列舉 $24,000（全民健保費全額列舉）');
        }

        // Mortgage interest
        const hasMortgage = profile.deductions.some(d => d.type === 'mortgage_interest');
        if (!hasMortgage && (profile.annualSalary || 0) > 1_000_000) {
            tips.push('🏠 自用住宅貸款利息每年最高可列舉 $300,000');
        }

        // Childcare
        if (profile.dependents > 0) {
            const hasChildcare = profile.deductions.some(d => d.type === 'childcare');
            if (!hasChildcare) {
                tips.push('👶 5 歲以下幼兒，每年可享幼兒學前特別扣除額 $120,000');
            }
        }

        // Charity
        const hasCharity = profile.deductions.some(d => d.type === 'charity');
        if (!hasCharity && estimation.taxBracketRate >= 20) {
            tips.push('❤️ 捐贈可列舉扣除（一般上限為所得 20%），在高稅率級距效果更好');
        }

        // Dividend tax method
        if (estimation.dividendAnalysis) {
            const da = estimation.dividendAnalysis;
            tips.push(`📊 股利建議使用「${da.recommendedMethod === 'combined' ? '合併計稅' : '分離課稅'}」，可省 $${da.savingsAmount.toLocaleString()}`);
        }

        // Retirement savings (勞退自提)
        if ((profile.annualSalary || 0) > 600_000) {
            tips.push('💰 勞退自提 6% 可從薪資所得中扣除，節稅效果顯著（高薪資者尤其建議）');
        }

        return tips;
    }
}

// ================================
// Types
// ================================

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
    effectiveRate: number; // percentage
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

export const taxService = new TaxService();
