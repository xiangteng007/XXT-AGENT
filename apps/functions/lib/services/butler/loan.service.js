"use strict";
/**
 * Loan Management Service
 *
 * Manages personal loans, mortgage tracking, amortization schedules,
 * prepayment calculations, and refinancing advice.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loanService = exports.LoanService = void 0;
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
class LoanService {
    /**
     * Add a new loan
     */
    async addLoan(uid, loan) {
        const monthlyPayment = loan.monthlyPayment || this.calculateMonthlyPayment(loan.principal, loan.interestRate, loan.termMonths);
        const docRef = await db.collection(`users/${uid}/butler/finance/loans`).add({
            ...loan,
            monthlyPayment,
            isActive: loan.isActive ?? true,
            createdAt: admin.firestore.Timestamp.now(),
        });
        return docRef.id;
    }
    /**
     * Get all active loans summary
     */
    async getLoanSummary(uid) {
        const snapshot = await db.collection(`users/${uid}/butler/finance/loans`)
            .where('isActive', '==', true).get();
        const loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const totalBalance = loans.reduce((sum, l) => sum + l.remainingBalance, 0);
        const totalMonthly = loans.reduce((sum, l) => sum + l.monthlyPayment, 0);
        const totalPrincipal = loans.reduce((sum, l) => sum + l.principal, 0);
        return {
            loans,
            totalRemainingBalance: Math.round(totalBalance),
            totalMonthlyPayment: Math.round(totalMonthly),
            totalOriginalPrincipal: Math.round(totalPrincipal),
            paidOffPercentage: totalPrincipal > 0
                ? Math.round((totalPrincipal - totalBalance) / totalPrincipal * 100)
                : 0,
            loanCount: loans.length,
        };
    }
    /**
     * Calculate monthly payment (等額本息 — equal installment)
     */
    calculateMonthlyPayment(principal, annualRate, termMonths) {
        const monthlyRate = annualRate / 100 / 12;
        if (monthlyRate === 0)
            return Math.round(principal / termMonths);
        const payment = principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)
            / (Math.pow(1 + monthlyRate, termMonths) - 1);
        return Math.round(payment);
    }
    /**
     * Generate amortization schedule
     */
    getAmortizationSchedule(principal, annualRate, termMonths) {
        const monthlyRate = annualRate / 100 / 12;
        const monthlyPayment = this.calculateMonthlyPayment(principal, annualRate, termMonths);
        const schedule = [];
        let balance = principal;
        for (let month = 1; month <= termMonths; month++) {
            const interest = Math.round(balance * monthlyRate);
            const principalPaid = monthlyPayment - interest;
            balance = Math.max(0, balance - principalPaid);
            schedule.push({
                month,
                payment: monthlyPayment,
                principal: principalPaid,
                interest,
                balance: Math.round(balance),
            });
            if (balance <= 0)
                break;
        }
        return schedule;
    }
    /**
     * Calculate prepayment savings
     */
    calculatePrepayment(principal, annualRate, termMonths, extraMonthlyPayment) {
        const monthlyRate = annualRate / 100 / 12;
        const originalPayment = this.calculateMonthlyPayment(principal, annualRate, termMonths);
        const originalTotalInterest = originalPayment * termMonths - principal;
        // Calculate with extra payments
        const newPayment = originalPayment + extraMonthlyPayment;
        let balance = principal;
        let totalInterest = 0;
        let months = 0;
        while (balance > 0 && months < termMonths) {
            const interest = balance * monthlyRate;
            const principalPaid = Math.min(newPayment - interest, balance);
            totalInterest += interest;
            balance -= principalPaid;
            months++;
        }
        return {
            originalTermMonths: termMonths,
            newTermMonths: months,
            monthsSaved: termMonths - months,
            originalTotalInterest: Math.round(originalTotalInterest),
            newTotalInterest: Math.round(totalInterest),
            interestSaved: Math.round(originalTotalInterest - totalInterest),
            extraMonthlyPayment,
        };
    }
    /**
     * Refinance comparison
     */
    calculateRefinance(remainingBalance, remainingMonths, currentRate, newRate, refinanceCost = 0) {
        const currentMonthly = this.calculateMonthlyPayment(remainingBalance, currentRate, remainingMonths);
        const newMonthly = this.calculateMonthlyPayment(remainingBalance, newRate, remainingMonths);
        const monthlySavings = currentMonthly - newMonthly;
        const totalSavings = monthlySavings * remainingMonths - refinanceCost;
        const breakEvenMonths = refinanceCost > 0 && monthlySavings > 0
            ? Math.ceil(refinanceCost / monthlySavings)
            : 0;
        return {
            currentMonthlyPayment: currentMonthly,
            newMonthlyPayment: newMonthly,
            monthlySavings,
            totalSavings: Math.round(totalSavings),
            breakEvenMonths,
            isWorthRefinancing: totalSavings > 0,
            recommendation: totalSavings > 0
                ? `轉貸可節省 $${totalSavings.toLocaleString()}，${breakEvenMonths} 個月即可回本`
                : '以目前條件轉貸不划算，建議暫不轉貸',
        };
    }
    /**
     * Generate loan management advice
     */
    getLoanAdvice(summary, monthlyIncome) {
        const advice = [];
        if (summary.loanCount === 0) {
            advice.push('✅ 目前無負債，財務狀況良好！');
            return advice;
        }
        // Debt-to-income ratio
        if (monthlyIncome && monthlyIncome > 0) {
            const dti = summary.totalMonthlyPayment / monthlyIncome;
            if (dti > 0.4) {
                advice.push(`⚠️ 每月還款佔收入 ${Math.round(dti * 100)}%，超過 40% 警戒線，建議降低負債`);
            }
            else if (dti > 0.3) {
                advice.push(`📊 每月還款佔收入 ${Math.round(dti * 100)}%，尚在安全範圍`);
            }
            else {
                advice.push(`✅ 負債比 ${Math.round(dti * 100)}% 良好`);
            }
        }
        // High interest loans
        const highInterest = summary.loans
            .filter(l => l.interestRate > 5)
            .sort((a, b) => b.interestRate - a.interestRate);
        if (highInterest.length > 0) {
            const worst = highInterest[0];
            advice.push(`📌 「${worst.name}」利率 ${worst.interestRate}% 偏高，建議優先償還或協商降息`);
        }
        // Multiple loans strategy
        if (summary.loanCount > 1) {
            advice.push('💡 多筆貸款建議用「雪崩法」(先還利率最高的) 或「雪球法」(先還餘額最小的)');
        }
        return advice;
    }
}
exports.LoanService = LoanService;
exports.loanService = new LoanService();
//# sourceMappingURL=loan.service.js.map