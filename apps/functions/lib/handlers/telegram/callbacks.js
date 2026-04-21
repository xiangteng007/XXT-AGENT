"use strict";
/**
 * Telegram Callback & Tool Handlers (V3 Audit #1)
 *
 * Extracted from telegram-webhook.handler.ts
 * Contains callback query handling, tool execution, and expense category flow.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCallbackQuery = handleCallbackQuery;
exports.handleExpenseCategory = handleExpenseCategory;
exports.executeTelegramToolCalls = executeTelegramToolCalls;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const api_1 = require("./api");
const commands_1 = require("./commands");
const finance_service_1 = require("../../services/finance.service");
const investment_service_1 = require("../../services/butler/investment.service");
const loan_service_1 = require("../../services/butler/loan.service");
const vehicle_service_1 = require("../../services/vehicle.service");
const schedule_service_1 = require("../../services/schedule.service");
const tax_service_1 = require("../../services/butler/tax.service");
const financial_advisor_service_1 = require("../../services/butler/financial-advisor.service");
const db = (0, firestore_1.getFirestore)();
// ================================
// Callback Query Handling
// ================================
async function handleCallbackQuery(query) {
    const chatId = query.message?.chat.id;
    const data = query.data;
    if (!chatId || !data)
        return;
    await (0, api_1.answerCallbackQuery)(query.id);
    if (data.startsWith('cmd_')) {
        const command = '/' + data.replace('cmd_', '');
        await (0, commands_1.handleCommand)(chatId, query.from.id, command);
    }
    else if (data.startsWith('expense_')) {
        const category = data.replace('expense_', '');
        await handleExpenseCategory(chatId, query.from.id, category);
    }
    else if (data === 'add_event') {
        await (0, api_1.sendMessage)(chatId, '📝 請直接輸入事件內容，例如：\n\n「下午2點開會」\n「明天10點看醫生」');
    }
    else if (data.startsWith('advice_topic_')) {
        const topic = data.replace('advice_topic_', '');
        await (0, api_1.sendChatAction)(chatId, 'typing');
        const linkedUid = await (0, api_1.getLinkedFirebaseUid)(query.from.id);
        if (!linkedUid) {
            await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號。使用 /link 開始。');
            return;
        }
        try {
            const report = await financial_advisor_service_1.financialAdvisorService.getFinancialAdvice(linkedUid, topic);
            await (0, api_1.sendMessage)(chatId, financial_advisor_service_1.financialAdvisorService.formatForLine(report));
        }
        catch (err) {
            v2_1.logger.error('[Telegram] Advice error:', err);
            await (0, api_1.sendMessage)(chatId, '❌ 產生建議時發生錯誤，請稍後再試。');
        }
    }
}
async function handleExpenseCategory(chatId, telegramUserId, category) {
    await db.collection('telegram_sessions').doc(telegramUserId.toString()).set({
        state: 'awaiting_expense_amount', category, updatedAt: firestore_1.Timestamp.now(),
    }, { merge: true });
    const categoryNames = {
        food: '🍔 餐飲', transport: '🚗 交通', shopping: '🛒 購物',
        entertainment: '🎮 娛樂', housing: '🏠 居住', other: '📱 其他',
    };
    await (0, api_1.sendMessage)(chatId, `已選擇：${categoryNames[category] || category}\n\n請輸入金額（數字）：`);
}
// ================================
// Tool Executor (shared with LINE)
// ================================
async function executeTelegramToolCalls(userId, toolCalls) {
    const results = [];
    for (const call of toolCalls) {
        try {
            switch (call.name) {
                case 'record_expense': {
                    const { amount, description, category } = call.args;
                    await finance_service_1.financeService.recordTransaction(userId, {
                        type: 'expense', amount,
                        description: description || '支出',
                        category: category || '其他',
                        date: new Date().toISOString().split('T')[0],
                        bankAccountId: '', source: 'manual',
                    });
                    results.push(`✅ 已記錄支出：$${amount} (${description || category || '其他'})`);
                    break;
                }
                case 'record_weight': {
                    const { weight } = call.args;
                    const today = new Date().toISOString().split('T')[0];
                    await db.doc(`users/${userId}/butler/health/daily/${today}`).set({ weight, date: today, updatedAt: firestore_1.Timestamp.now() }, { merge: true });
                    results.push(`✅ 已記錄體重：${weight} kg`);
                    break;
                }
                case 'add_event': {
                    const { title, date, startTime } = call.args;
                    await schedule_service_1.scheduleService.addEvent(userId, {
                        title, start: startTime ? `${date}T${startTime}:00` : date,
                        end: date, allDay: !startTime, location: '',
                        category: 'personal', reminders: [], source: 'manual',
                    });
                    results.push(`✅ 已新增行程：${title} (${date}${startTime ? ' ' + startTime : ''})`);
                    break;
                }
                case 'get_schedule': {
                    const schedule = await schedule_service_1.scheduleService.getTodaySchedule(userId);
                    if (schedule?.events?.length > 0) {
                        const list = schedule.events.map(e => `• ${typeof e.start === 'string' ? e.start.split('T')[1]?.slice(0, 5) || '全天' : '全天'} ${e.title}`).join('\n');
                        results.push(`📅 今日行程：\n${list}`);
                    }
                    else {
                        results.push('📅 今日沒有排定的行程');
                    }
                    break;
                }
                case 'get_spending': {
                    const now = new Date();
                    const summary = await finance_service_1.financeService.getMonthlySummary(userId, now.getFullYear(), now.getMonth() + 1);
                    results.push(summary ? `💰 本月花費：$${(summary.totalExpenses || 0).toLocaleString()}` : '💰 目前沒有消費記錄');
                    break;
                }
                case 'record_fuel': {
                    const { liters, price_per_liter } = call.args;
                    await vehicle_service_1.vehicleService.recordFuel(userId, 'default', {
                        liters, pricePerLiter: price_per_liter, mileage: 0, isFull: true,
                    });
                    results.push(`⛽ 已記錄加油：${liters}L × $${price_per_liter}/L = $${(liters * price_per_liter).toFixed(0)}`);
                    break;
                }
                case 'add_investment': {
                    const { symbol, action, shares, price } = call.args;
                    const tradeType = action === 'sell' ? 'sell' : 'buy';
                    await investment_service_1.investmentService.recordTrade(userId, {
                        holdingId: '', type: tradeType, symbol: symbol.toUpperCase(),
                        shares, price, totalAmount: shares * price, fee: 0,
                        date: new Date().toISOString().split('T')[0],
                    });
                    results.push(`✅ 已記錄${tradeType === 'buy' ? '買入' : '賣出'}：${symbol} ${shares}股 × $${price}`);
                    break;
                }
                case 'get_portfolio': {
                    const portfolio = await investment_service_1.investmentService.getPortfolioSummary(userId);
                    if (portfolio.holdingCount > 0) {
                        const hl = portfolio.holdings.slice(0, 5).map(h => `• ${h.symbol}: ${h.shares}股`).join('\n');
                        results.push(`📈 投資組合（${portfolio.holdingCount} 檔）\n總市值：$${portfolio.totalMarketValue.toLocaleString()}\n${hl}`);
                    }
                    else {
                        results.push('📈 尚未建立投資組合');
                    }
                    break;
                }
                case 'calculate_loan': {
                    const { principal, annual_rate, term_months } = call.args;
                    const monthly = loan_service_1.loanService.calculateMonthlyPayment(principal, annual_rate, term_months);
                    const totalInterest = monthly * term_months - principal;
                    results.push(`🏦 貸款試算\n貸款: $${principal.toLocaleString()}, ${annual_rate}%, ${term_months}月\n每月: $${monthly.toLocaleString()}\n總利息: $${totalInterest.toLocaleString()}`);
                    break;
                }
                case 'estimate_tax': {
                    const { annual_salary, investment_income, dependents } = call.args;
                    const estimation = tax_service_1.taxService.estimateIncomeTax({
                        annualSalary: annual_salary, investmentIncome: investment_income || 0,
                        dependents: dependents || 0, filingStatus: 'single', deductions: [],
                        year: new Date().getFullYear(),
                    });
                    results.push(`📋 稅務估算 (${estimation.year})\n所得: $${estimation.grossIncome.toLocaleString()}\n稅率: ${estimation.taxBracketRate}%\n稅額: $${estimation.estimatedTax.toLocaleString()}\n有效稅率: ${estimation.effectiveRate}%`);
                    break;
                }
                case 'get_financial_advice': {
                    const { topic } = call.args;
                    const report = await financial_advisor_service_1.financialAdvisorService.getFinancialAdvice(userId, topic || 'comprehensive');
                    results.push(financial_advisor_service_1.financialAdvisorService.formatForLine(report));
                    break;
                }
                default:
                    results.push(`⚠️ 未支援的操作：${call.name}`);
            }
        }
        catch (err) {
            v2_1.logger.error(`[Telegram] Tool call ${call.name} failed:`, err);
            results.push(`❌ ${call.name} 執行失敗`);
        }
    }
    return results;
}
//# sourceMappingURL=callbacks.js.map