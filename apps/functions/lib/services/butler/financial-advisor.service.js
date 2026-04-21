"use strict";
/**
 * Financial Advisor Service
 *
 * AI-powered comprehensive financial advisory leveraging Gemini.
 * Integrates data from all financial domains (spending, investments, loans, tax)
 * to generate personalized, actionable advice.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.financialAdvisorService = exports.FinancialAdvisorService = void 0;
const finance_service_1 = require("../finance.service");
const investment_service_1 = require("./investment.service");
const loan_service_1 = require("./loan.service");
const tax_service_1 = require("./tax.service");
class FinancialAdvisorService {
    /**
     * Generate comprehensive financial advice
     */
    async getFinancialAdvice(uid, topic) {
        const selectedTopic = topic || 'comprehensive';
        // Gather all available financial data
        const [spendingInsights, portfolioSummary, allocation, loanSummary, taxProfile] = await Promise.allSettled([
            finance_service_1.financeService.getSpendingInsights(uid, 3),
            investment_service_1.investmentService.getPortfolioSummary(uid),
            investment_service_1.investmentService.getAssetAllocation(uid),
            loan_service_1.loanService.getLoanSummary(uid),
            tax_service_1.taxService.getTaxProfile(uid),
        ]);
        const spending = spendingInsights.status === 'fulfilled' ? spendingInsights.value : null;
        const portfolio = portfolioSummary.status === 'fulfilled' ? portfolioSummary.value : null;
        const assetAlloc = allocation.status === 'fulfilled' ? allocation.value : [];
        const loans = loanSummary.status === 'fulfilled' ? loanSummary.value : null;
        const tax = taxProfile.status === 'fulfilled' ? taxProfile.value : null;
        // Build advice sections based on topic
        const sections = [];
        // ── Financial Health Score ──
        if (selectedTopic === 'comprehensive') {
            const score = this.calculateHealthScore(spending, portfolio, loans);
            sections.push({
                title: '📊 財務健康評分',
                score: score.total,
                items: [
                    `整體評分：${score.total}/100`,
                    `儲蓄力：${score.savings}/25`,
                    `投資力：${score.investment}/25`,
                    `負債管理：${score.debt}/25`,
                    `風險保障：${score.risk}/25`,
                ],
            });
        }
        // ── Spending Analysis ──
        if (['comprehensive', 'emergency_fund'].includes(selectedTopic) && spending) {
            const monthlyNet = spending.averageMonthlyIncome - spending.averageMonthlyExpenses;
            const emergencyMonths = spending.averageMonthlyExpenses > 0
                ? Math.round(monthlyNet * 6 / spending.averageMonthlyExpenses * 10) / 10
                : 0;
            sections.push({
                title: '💰 收支分析',
                items: [
                    `月均收入：$${spending.averageMonthlyIncome.toLocaleString()}`,
                    `月均支出：$${spending.averageMonthlyExpenses.toLocaleString()}`,
                    `儲蓄率：${spending.averageSavingsRate}%`,
                    `支出趨勢：${spending.spendingTrend === 'increasing' ? '上升 📈' : spending.spendingTrend === 'decreasing' ? '下降 📉' : '穩定 ➖'}`,
                    ...spending.suggestions,
                ],
            });
            if (selectedTopic === 'emergency_fund' || selectedTopic === 'comprehensive') {
                const emergencyAdvice = [];
                if (emergencyMonths < 3) {
                    emergencyAdvice.push(`⚠️ 以目前儲蓄速度，約 ${emergencyMonths} 個月可建立緊急預備金`);
                    emergencyAdvice.push('建議目標：至少 6 個月支出（$' + (spending.averageMonthlyExpenses * 6).toLocaleString() + '）');
                    emergencyAdvice.push('優先將多餘資金存入高利活存帳戶');
                }
                else {
                    emergencyAdvice.push('✅ 儲蓄率足以在合理時間內建立緊急預備金');
                }
                sections.push({ title: '🛡️ 緊急預備金', items: emergencyAdvice });
            }
        }
        // ── Investment Portfolio ──
        if (['comprehensive', 'portfolio_review'].includes(selectedTopic) && portfolio) {
            const investAdvice = investment_service_1.investmentService.getInvestmentAdvice(portfolio, assetAlloc);
            const allocStr = assetAlloc.map(a => `${a.label} ${a.percentage}%`).join('、');
            sections.push({
                title: '📈 投資組合',
                items: [
                    `總市值：$${portfolio.totalMarketValue.toLocaleString()}`,
                    `未實現損益：${portfolio.totalUnrealizedPnL >= 0 ? '+' : ''}$${portfolio.totalUnrealizedPnL.toLocaleString()} (${portfolio.returnRate}%)`,
                    `持倉數：${portfolio.holdingCount} 檔`,
                    `配置：${allocStr || '無'}`,
                    ...investAdvice,
                ],
            });
        }
        // ── Debt Management ──
        if (['comprehensive', 'debt_strategy'].includes(selectedTopic) && loans) {
            const monthlyIncome = spending?.averageMonthlyIncome;
            const loanAdvice = loan_service_1.loanService.getLoanAdvice(loans, monthlyIncome);
            sections.push({
                title: '🏦 負債管理',
                items: [
                    `貸款筆數：${loans.loanCount}`,
                    `剩餘本金：$${loans.totalRemainingBalance.toLocaleString()}`,
                    `每月還款：$${loans.totalMonthlyPayment.toLocaleString()}`,
                    `已還清比例：${loans.paidOffPercentage}%`,
                    ...loanAdvice,
                ],
            });
        }
        // ── Tax Optimization ──
        if (['comprehensive', 'tax_optimization'].includes(selectedTopic) && tax) {
            const estimation = tax_service_1.taxService.estimateIncomeTax(tax);
            const tips = tax_service_1.taxService.getTaxSavingTips(tax, estimation);
            sections.push({
                title: '📋 稅務估算',
                items: [
                    `${estimation.year} 年度綜合所得：$${estimation.grossIncome.toLocaleString()}`,
                    `適用稅率：${estimation.taxBracketRate}%`,
                    `預估應繳稅額：$${estimation.estimatedTax.toLocaleString()}`,
                    `有效稅率：${estimation.effectiveRate}%`,
                    `扣除方式：${estimation.deductionMethod === 'standard' ? '標準扣除' : '列舉扣除'}`,
                    ...tips,
                ],
            });
        }
        // ── Retirement Planning ──
        if (selectedTopic === 'retirement_planning' || selectedTopic === 'comprehensive') {
            const retirement = this.estimateRetirement(spending, portfolio);
            sections.push({
                title: '🏖️ 退休規劃',
                items: retirement,
            });
        }
        // ── Action Items ──
        const actionItems = this.generateActionItems(sections);
        return {
            topic: selectedTopic,
            generatedAt: new Date().toISOString(),
            sections,
            actionItems,
            summary: this.generateSummary(sections),
        };
    }
    /**
     * Calculate financial health score (0-100)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    calculateHealthScore(spending, portfolio, loans) {
        let savings = 0, investment = 0, debt = 25;
        const risk = 10;
        if (spending) {
            savings = Math.min(25, Math.round(spending.averageSavingsRate / 20 * 25));
        }
        if (portfolio && portfolio.holdingCount > 0) {
            investment = Math.min(25, 10 + (portfolio.holdingCount >= 5 ? 10 : portfolio.holdingCount * 2)
                + (portfolio.returnRate > 0 ? 5 : 0));
        }
        if (loans) {
            if (loans.loanCount === 0) {
                debt = 25;
            }
            else if (spending) {
                const dti = loans.totalMonthlyPayment / (spending.averageMonthlyIncome || 1);
                debt = Math.max(0, Math.round(25 - dti * 50));
            }
        }
        return { savings, investment, debt, risk, total: savings + investment + debt + risk };
    }
    /**
     * Estimate retirement readiness
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    estimateRetirement(spending, portfolio) {
        const items = [];
        const monthlyExpense = spending?.averageMonthlyExpenses || 40_000;
        const monthlySavings = spending
            ? spending.averageMonthlyIncome - spending.averageMonthlyExpenses
            : 0;
        const currentAssets = portfolio?.totalMarketValue || 0;
        // Simple 4% rule estimation
        const retirementNeeded = monthlyExpense * 12 * 25; // 25 years of expenses
        const yearsToRetirement = monthlySavings > 0
            ? Math.round((retirementNeeded - currentAssets) / (monthlySavings * 12 * 1.06)) // ~6% return
            : 99;
        items.push(`目標退休金（4% 法則）：$${retirementNeeded.toLocaleString()}`);
        items.push(`目前投資資產：$${currentAssets.toLocaleString()}`);
        items.push(`距離目標：$${Math.max(0, retirementNeeded - currentAssets).toLocaleString()}`);
        if (monthlySavings > 0) {
            items.push(`以目前儲蓄率+投資報酬，預計約 ${Math.max(0, yearsToRetirement)} 年可達標`);
        }
        else {
            items.push('⚠️ 目前月存款為負，需先改善收支平衡');
        }
        if (monthlySavings > 0 && monthlySavings < monthlyExpense * 0.3) {
            items.push('💡 建議將儲蓄率提升至收入 30% 以上，加速退休目標');
        }
        return items;
    }
    /**
     * Generate priority action items
     */
    generateActionItems(sections) {
        const actions = [];
        for (const section of sections) {
            for (const item of section.items) {
                if (item.startsWith('⚠️') || item.startsWith('📌')) {
                    actions.push(item);
                }
            }
        }
        if (actions.length === 0) {
            actions.push('✅ 財務狀況良好，持續保持！');
        }
        return actions.slice(0, 5); // Top 5 priorities
    }
    /**
     * Generate executive summary
     */
    generateSummary(sections) {
        const scoreSection = sections.find(s => s.title.includes('評分'));
        const score = scoreSection?.score;
        if (score && score >= 80)
            return '🌟 財務狀況優秀！持續保持現有策略，適度優化即可。';
        if (score && score >= 60)
            return '👍 財務基礎穩健，有幾個面向可以加強。';
        if (score && score >= 40)
            return '📊 財務狀況尚可，建議優先處理標記的改善項目。';
        return '⚠️ 財務需要關注，建議優先改善儲蓄和負債管理。';
    }
    /**
     * Format advice as LINE-friendly text
     */
    formatForLine(report) {
        const lines = [];
        lines.push(`🤖 理財顧問報告\n`);
        for (const section of report.sections) {
            lines.push(`\n${section.title}`);
            for (const item of section.items) {
                lines.push(`  ${item}`);
            }
        }
        if (report.actionItems.length > 0) {
            lines.push('\n🎯 優先行動');
            report.actionItems.forEach((a, i) => lines.push(`  ${i + 1}. ${a}`));
        }
        lines.push(`\n${report.summary}`);
        return lines.join('\n');
    }
}
exports.FinancialAdvisorService = FinancialAdvisorService;
exports.financialAdvisorService = new FinancialAdvisorService();
//# sourceMappingURL=financial-advisor.service.js.map