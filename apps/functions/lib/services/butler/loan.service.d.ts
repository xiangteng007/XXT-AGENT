/**
 * Loan Management Service
 *
 * Manages personal loans, mortgage tracking, amortization schedules,
 * prepayment calculations, and refinancing advice.
 */
import { Loan } from '../../types/butler.types';
export declare class LoanService {
    /**
     * Add a new loan
     */
    addLoan(uid: string, loan: Omit<Loan, 'id' | 'createdAt'>): Promise<string>;
    /**
     * Get all active loans summary
     */
    getLoanSummary(uid: string): Promise<LoanSummary>;
    /**
     * Calculate monthly payment (等額本息 — equal installment)
     */
    calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number;
    /**
     * Generate amortization schedule
     */
    getAmortizationSchedule(principal: number, annualRate: number, termMonths: number): AmortizationEntry[];
    /**
     * Calculate prepayment savings
     */
    calculatePrepayment(principal: number, annualRate: number, termMonths: number, extraMonthlyPayment: number): PrepaymentResult;
    /**
     * Refinance comparison
     */
    calculateRefinance(remainingBalance: number, remainingMonths: number, currentRate: number, newRate: number, refinanceCost?: number): RefinanceResult;
    /**
     * Generate loan management advice
     */
    getLoanAdvice(summary: LoanSummary, monthlyIncome?: number): string[];
}
export interface LoanSummary {
    loans: Loan[];
    totalRemainingBalance: number;
    totalMonthlyPayment: number;
    totalOriginalPrincipal: number;
    paidOffPercentage: number;
    loanCount: number;
}
export interface AmortizationEntry {
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
}
export interface PrepaymentResult {
    originalTermMonths: number;
    newTermMonths: number;
    monthsSaved: number;
    originalTotalInterest: number;
    newTotalInterest: number;
    interestSaved: number;
    extraMonthlyPayment: number;
}
export interface RefinanceResult {
    currentMonthlyPayment: number;
    newMonthlyPayment: number;
    monthlySavings: number;
    totalSavings: number;
    breakEvenMonths: number;
    isWorthRefinancing: boolean;
    recommendation: string;
}
export declare const loanService: LoanService;
//# sourceMappingURL=loan.service.d.ts.map