"use strict";
/**
 * Butler LINE Webhook Handler
 *
 * Handles incoming LINE webhook events for the 小秘書 (Personal Butler) bot.
 * Responds to user messages with Butler AI capabilities.
 * Supports Flex Message cards for finance, health, vehicle, and schedule domains.
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
exports.handleButlerWebhook = handleButlerWebhook;
const v2_1 = require("firebase-functions/v2");
const crypto = __importStar(require("crypto"));
const butler_ai_service_1 = require("../services/butler-ai.service");
const receipt_ocr_service_1 = require("../services/butler/receipt-ocr.service");
const butler_flex_service_1 = require("../services/butler-flex.service");
const conversation_session_service_1 = require("../services/butler/conversation-session.service");
const finance_service_1 = require("../services/finance.service");
const health_service_1 = require("../services/health.service");
const vehicle_service_1 = require("../services/vehicle.service");
const schedule_service_1 = require("../services/schedule.service");
const investment_service_1 = require("../services/butler/investment.service");
const loan_service_1 = require("../services/butler/loan.service");
const tax_service_1 = require("../services/butler/tax.service");
const financial_advisor_service_1 = require("../services/butler/financial-advisor.service");
const butler_commands_service_1 = require("../services/butler/butler-commands.service");
// LINE Channel Secret for signature verification
// SECURITY: These MUST be set via environment variables - no fallback values allowed
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
// Validate required environment variables (lazy - only warn at startup)
if (!CHANNEL_SECRET || !CHANNEL_ACCESS_TOKEN) {
    v2_1.logger.warn('WARNING: LINE_CHANNEL_SECRET and/or LINE_CHANNEL_ACCESS_TOKEN not set - LINE Bot features disabled');
}
// LINE API Base URL
const LINE_API_BASE = 'https://api.line.me/v2/bot';
// ================================
// Main Handler
// ================================
async function handleButlerWebhook(req, res) {
    v2_1.logger.info('[Butler Webhook] Received request');
    // Verify LINE signature
    const signature = req.headers['x-line-signature'];
    if (!signature) {
        v2_1.logger.warn('[Butler Webhook] Missing signature');
        res.status(401).send('Missing signature');
        return;
    }
    // Get raw body for signature verification
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('SHA256', CHANNEL_SECRET || '')
        .update(rawBody)
        .digest('base64');
    if (signature !== expectedSignature) {
        v2_1.logger.warn('[Butler Webhook] Invalid signature');
        res.status(401).send('Invalid signature');
        return;
    }
    // Parse body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    v2_1.logger.info('[Butler Webhook] Events:', body.events?.length || 0);
    // Process events
    if (body.events && body.events.length > 0) {
        for (const event of body.events) {
            try {
                await processButlerEvent(event);
            }
            catch (error) {
                v2_1.logger.error('[Butler Webhook] Error processing event:', error);
            }
        }
    }
    // Fast ACK
    res.status(200).send('OK');
}
// ================================
// Event Processing
// ================================
async function processButlerEvent(event) {
    v2_1.logger.info('[Butler] Processing event:', event.type);
    switch (event.type) {
        case 'message':
            await handleMessageEvent(event);
            break;
        case 'postback':
            await handlePostbackEvent(event);
            break;
        case 'follow':
            await handleFollowEvent(event);
            break;
        case 'unfollow':
            v2_1.logger.info('[Butler] User unfollowed:', event.source.userId);
            break;
        default:
            v2_1.logger.info('[Butler] Unhandled event type:', event.type);
    }
}
// ================================
// Message Handling
// ================================
async function handleMessageEvent(event) {
    if (!event.replyToken || !event.message) {
        return;
    }
    const userId = event.source.userId;
    // Handle image messages → Receipt OCR
    if (event.message.type === 'image' && userId) {
        v2_1.logger.info(`[Butler] Image from ${userId}, processing receipt OCR`);
        const imageUrl = `https://api-data.line.me/v2/bot/message/${event.message.id}/content`;
        const result = await (0, receipt_ocr_service_1.processReceiptImage)(userId, imageUrl, CHANNEL_ACCESS_TOKEN);
        await replyMessage(event.replyToken, [
            { type: 'text', text: result, quickReply: (0, butler_flex_service_1.buildQuickReplyButtons)() },
        ]);
        return;
    }
    const messageText = event.message.text || '';
    v2_1.logger.info(`[Butler] Message from ${userId}: ${messageText}`);
    // Handle special commands
    if (messageText === '清除對話' || messageText === '重新開始') {
        if (userId)
            await (0, conversation_session_service_1.clearSession)(userId);
        await replyMessage(event.replyToken, [
            { type: 'text', text: '🔄 對話已重置，有什麼我可以幫您的嗎？', quickReply: (0, butler_flex_service_1.buildQuickReplyButtons)() },
        ]);
        return;
    }
    // Quick-record commands: 記帳/體重/加油/行程 etc.
    const command = (0, butler_commands_service_1.parseCommand)(messageText);
    if (command && userId) {
        v2_1.logger.info(`[Butler] Command detected: ${command.action} (${command.confidence})`);
        const result = await (0, butler_commands_service_1.executeCommand)(userId, command);
        // Save to session for potential undo
        await (0, conversation_session_service_1.appendMessage)(userId, 'user', messageText);
        await (0, conversation_session_service_1.appendMessage)(userId, 'assistant', result);
        await replyMessage(event.replyToken, [
            { type: 'text', text: result, quickReply: (0, butler_flex_service_1.buildQuickReplyButtons)() },
        ]);
        return;
    }
    // Detect domain for Flex Message reply
    const domain = (0, butler_flex_service_1.detectDomain)(messageText);
    v2_1.logger.info(`[Butler] Detected domain: ${domain}`);
    // Try Flex Message for specific domains
    const flexCard = await buildFlexReply(domain, messageText, userId);
    if (flexCard) {
        await replyMessage(event.replyToken, [flexCard]);
        return;
    }
    // Multi-turn: save user message and get history
    if (userId) {
        await (0, conversation_session_service_1.appendMessage)(userId, 'user', messageText);
    }
    // Get conversation history for context
    const history = userId ? await (0, conversation_session_service_1.getPreviousMessages)(userId) : [];
    const contextPrefix = history.length > 1
        ? `以下是之前的對話紀錄：\n${history.slice(0, -1).join('\n')}\n\n用戶最新問題：${messageText}`
        : messageText;
    // Try AI with function calling first (allows autonomous actions)
    if (userId) {
        try {
            const aiResult = await (0, butler_ai_service_1.generateAIResponseWithTools)(messageText, userId, '');
            if (aiResult.toolCalls && aiResult.toolCalls.length > 0) {
                const toolResults = await executeToolCalls(userId, aiResult.toolCalls);
                const combinedResponse = toolResults.join('\n\n');
                await (0, conversation_session_service_1.appendMessage)(userId, 'assistant', combinedResponse);
                await replyMessage(event.replyToken, [
                    { type: 'text', text: combinedResponse, quickReply: (0, butler_flex_service_1.buildQuickReplyButtons)() },
                ]);
                return;
            }
        }
        catch (toolErr) {
            v2_1.logger.warn('[Butler] Function calling failed, falling back to standard AI:', toolErr);
        }
    }
    // Standard AI text response with conversation context
    const response = await (0, butler_ai_service_1.generateAIResponse)(contextPrefix, userId);
    // Save assistant response to session
    if (userId) {
        await (0, conversation_session_service_1.appendMessage)(userId, 'assistant', response);
    }
    await replyMessage(event.replyToken, [
        { type: 'text', text: response, quickReply: (0, butler_flex_service_1.buildQuickReplyButtons)() },
    ]);
}
// ================================
// Function Calling Executor
// ================================
async function executeToolCalls(userId, toolCalls) {
    const results = [];
    for (const call of toolCalls) {
        try {
            switch (call.name) {
                case 'record_expense': {
                    const { amount, description, category } = call.args;
                    await finance_service_1.financeService.recordTransaction(userId, {
                        type: 'expense',
                        amount,
                        description: description || '支出',
                        category: category || '其他',
                        date: new Date().toISOString().split('T')[0],
                        bankAccountId: '',
                        source: 'manual',
                    });
                    results.push(`✅ 已記錄支出：$${amount} (${description || category || '其他'})`);
                    break;
                }
                case 'record_weight': {
                    const { weight } = call.args;
                    await health_service_1.healthService.recordWeight(userId, weight);
                    results.push(`✅ 已記錄體重：${weight} kg`);
                    break;
                }
                case 'add_event': {
                    const { title, date, startTime, location } = call.args;
                    const startStr = startTime ? `${date}T${startTime}:00` : date;
                    const endStr = startTime ? `${date}T${String(Number(startTime.split(':')[0]) + 1).padStart(2, '0')}:${startTime.split(':')[1]}:00` : date;
                    await schedule_service_1.scheduleService.addEvent(userId, {
                        title,
                        start: startStr,
                        end: endStr,
                        allDay: !startTime,
                        location: location || '',
                        category: 'personal',
                        reminders: [],
                        source: 'line',
                    });
                    results.push(`✅ 已新增行程：${title} (${date}${startTime ? ' ' + startTime : ''})`);
                    break;
                }
                case 'get_schedule': {
                    const schedule = await schedule_service_1.scheduleService.getTodaySchedule(userId);
                    if (schedule && schedule.events && schedule.events.length > 0) {
                        const list = schedule.events.map((e) => `• ${typeof e.start === 'string' ? e.start.split('T')[1]?.slice(0, 5) || '全天' : '全天'} ${e.title}`).join('\n');
                        results.push(`📅 今日行程：\n${list}`);
                    }
                    else {
                        results.push('📅 今日沒有排定的行程');
                    }
                    break;
                }
                case 'get_spending': {
                    const { period } = call.args;
                    const now = new Date();
                    const summary = await finance_service_1.financeService.getMonthlySummary(userId, now.getFullYear(), now.getMonth() + 1);
                    if (summary) {
                        results.push(`💰 ${period || '本月'}花費：$${(summary.totalExpenses || 0).toLocaleString()}`);
                    }
                    else {
                        results.push('💰 目前沒有消費記錄');
                    }
                    break;
                }
                case 'record_fuel': {
                    const { liters, price_per_liter, mileage } = call.args;
                    // Use default vehicleId — user's primary vehicle
                    const vehicleId = 'default';
                    await vehicle_service_1.vehicleService.recordFuel(userId, vehicleId, {
                        liters,
                        pricePerLiter: price_per_liter,
                        mileage: mileage || 0,
                        isFull: true,
                    });
                    results.push(`⛽ 已記錄加油：${liters}L × $${price_per_liter}/L = $${(liters * price_per_liter).toFixed(0)}`);
                    break;
                }
                case 'add_investment': {
                    const { symbol, action, shares, price } = call.args;
                    const tradeType = action === 'sell' ? 'sell' : 'buy';
                    await investment_service_1.investmentService.recordTrade(userId, {
                        holdingId: '',
                        type: tradeType,
                        symbol: symbol.toUpperCase(),
                        shares,
                        price,
                        totalAmount: shares * price,
                        fee: 0,
                        date: new Date().toISOString().split('T')[0],
                    });
                    results.push(`✅ 已記錄${tradeType === 'buy' ? '買入' : '賣出'}：${symbol} ${shares}股 × $${price}`);
                    break;
                }
                case 'get_portfolio': {
                    const portfolio = await investment_service_1.investmentService.getPortfolioSummary(userId);
                    if (portfolio.holdingCount > 0) {
                        const holdingList = portfolio.holdings.slice(0, 5).map(h => `• ${h.symbol} ${h.name}: ${h.shares}股, 均價$${h.avgCost}`).join('\n');
                        results.push(`📈 投資組合（${portfolio.holdingCount} 檔）\n` +
                            `總市值：$${portfolio.totalMarketValue.toLocaleString()}\n` +
                            `未實現損益：${portfolio.totalUnrealizedPnL >= 0 ? '+' : ''}$${portfolio.totalUnrealizedPnL.toLocaleString()} (${portfolio.returnRate}%)\n` +
                            holdingList);
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
                    results.push(`🏦 貸款試算\n` +
                        `貸款金額：$${principal.toLocaleString()}\n` +
                        `年利率：${annual_rate}%，期數：${term_months}個月\n` +
                        `每月應繳：$${monthly.toLocaleString()}\n` +
                        `總利息：$${totalInterest.toLocaleString()}`);
                    break;
                }
                case 'estimate_tax': {
                    const { annual_salary, investment_income, dependents } = call.args;
                    const estimation = tax_service_1.taxService.estimateIncomeTax({
                        annualSalary: annual_salary,
                        investmentIncome: investment_income || 0,
                        dependents: dependents || 0,
                        filingStatus: 'single',
                        deductions: [],
                        year: new Date().getFullYear(),
                    });
                    let taxMsg = `📋 稅務估算 (${estimation.year})\n` +
                        `綜合所得：$${estimation.grossIncome.toLocaleString()}\n` +
                        `適用稅率：${estimation.taxBracketRate}%\n` +
                        `預估應繳：$${estimation.estimatedTax.toLocaleString()}\n` +
                        `有效稅率：${estimation.effectiveRate}%`;
                    if (estimation.dividendAnalysis) {
                        const da = estimation.dividendAnalysis;
                        taxMsg += `\n股利節稅：建議「${da.recommendedMethod === 'combined' ? '合併計稅' : '分離課稅'}}」，省 $${da.savingsAmount.toLocaleString()}`;
                    }
                    results.push(taxMsg);
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
            v2_1.logger.error(`[Butler] Tool call ${call.name} failed:`, err);
            results.push(`❌ ${call.name} 執行失敗，請稍後再試`);
        }
    }
    return results;
}
async function handlePostbackEvent(event) {
    if (!event.replyToken || !event.postback) {
        return;
    }
    const userId = event.source.userId;
    const postbackData = event.postback.data;
    v2_1.logger.info(`[Butler] Postback from ${userId}: ${postbackData}`);
    // Parse action from postback data
    const params = new URLSearchParams(postbackData);
    const action = params.get('action');
    switch (action) {
        case 'ai_chat':
            await replyMessage(event.replyToken, [{
                    type: 'text',
                    text: '🤖 AI 助理已準備好，請直接輸入您的問題！',
                    quickReply: (0, butler_flex_service_1.buildQuickReplyButtons)(),
                }]);
            return;
        case 'clear_session':
            if (userId)
                await (0, conversation_session_service_1.clearSession)(userId);
            await replyMessage(event.replyToken, [{
                    type: 'text',
                    text: '🔄 對話已重置，有什麼我可以幫您的嗎？',
                }]);
            return;
        default:
            break;
    }
    // Default: use AI response for postback data
    const response = await (0, butler_ai_service_1.generateAIResponse)(postbackData, userId);
    await replyMessage(event.replyToken, [{
            type: 'text',
            text: response,
            quickReply: (0, butler_flex_service_1.buildQuickReplyButtons)(),
        }]);
}
async function handleFollowEvent(event) {
    if (!event.replyToken)
        return;
    const welcomeMessage = `👋 您好！我是小秘書，您的個人智能管家助理。

我可以幫助您：
📋 管理行程與提醒
💰 追蹤財務支出
🚗 管理愛車資訊
🏃 記錄健康數據
🏢 追蹤工作專案

直接輸入您的需求，我會盡力為您服務！

💡 試試看說：
• "今天行程"
• "這個月支出多少"
• "車輛該保養了嗎"`;
    await replyMessage(event.replyToken, [{
            type: 'text',
            text: welcomeMessage,
        }]);
}
// ================================
// Flex Message Reply Builder
// ================================
async function buildFlexReply(domain, _messageText, userId) {
    try {
        const now = new Date();
        switch (domain) {
            case 'finance': {
                const summary = userId
                    ? await finance_service_1.financeService.getMonthlySummary(userId, now.getFullYear(), now.getMonth() + 1)
                    : null;
                const categoryEntries = summary?.expensesByCategory
                    ? Object.entries(summary.expensesByCategory)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 3)
                        .map(([name, amount]) => ({ name, amount: amount, emoji: '💳' }))
                    : [];
                return (0, butler_flex_service_1.buildFinanceSummaryCard)({
                    monthLabel: now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' }),
                    totalExpense: summary?.totalExpenses ?? 0,
                    totalIncome: summary?.totalIncome ?? 0,
                    topCategories: categoryEntries,
                    trend: (summary?.netSavings ?? 0) > 0 ? 'up' : (summary?.netSavings ?? 0) < 0 ? 'down' : 'flat',
                });
            }
            case 'health': {
                const todayHealth = userId
                    ? await health_service_1.healthService.getTodayHealth(userId)
                    : null;
                return (0, butler_flex_service_1.buildHealthSummaryCard)({
                    date: now.toLocaleDateString('zh-TW'),
                    steps: todayHealth?.steps ?? 0,
                    stepsGoal: 8000,
                    activeMinutes: todayHealth?.activeMinutes ?? 0,
                    calories: todayHealth?.caloriesBurned ?? 0,
                    sleepHours: todayHealth?.sleepHours ?? 0,
                });
            }
            case 'vehicle': {
                // Get first vehicle for the user
                const dashboard = userId
                    ? await vehicle_service_1.vehicleService.getDashboard(userId, 'default').catch(() => null)
                    : null;
                return (0, butler_flex_service_1.buildVehicleStatusCard)({
                    make: dashboard?.vehicle?.make ?? 'Suzuki',
                    model: dashboard?.vehicle?.model ?? 'Jimny',
                    variant: dashboard?.vehicle?.variant ?? 'JB74',
                    licensePlate: dashboard?.vehicle?.licensePlate ?? '---',
                    mileage: dashboard?.vehicle?.currentMileage ?? 0,
                    nextServiceMileage: dashboard?.urgentReminders?.[0]?.dueMileage ?? 5000,
                    insuranceExpiry: '---',
                    inspectionExpiry: '---',
                });
            }
            case 'schedule': {
                const dailySchedule = userId
                    ? await schedule_service_1.scheduleService.getTodaySchedule(userId)
                    : null;
                const events = dailySchedule?.events?.map(e => ({
                    time: typeof e.start === 'string'
                        ? e.start
                        : e.start.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                    title: e.title,
                    location: e.location,
                    emoji: e.category === 'work' ? '💼' : e.category === 'health' ? '🏃' : '📌',
                })) ?? [];
                return (0, butler_flex_service_1.buildScheduleCard)({
                    date: now.toLocaleDateString('zh-TW', { weekday: 'long', month: 'long', day: 'numeric' }),
                    events,
                });
            }
            default:
                return null;
        }
    }
    catch (err) {
        v2_1.logger.error(`[Butler] Flex build failed for ${domain}:`, err);
        return null;
    }
}
// ================================
// LINE API Helpers
// ================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function replyMessage(replyToken, messages) {
    try {
        const response = await fetch(`${LINE_API_BASE}/message/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                replyToken,
                messages,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            v2_1.logger.error('[Butler] Reply failed:', error);
        }
        else {
            v2_1.logger.info('[Butler] Reply sent successfully');
        }
    }
    catch (error) {
        v2_1.logger.error('[Butler] Reply error:', error);
    }
}
//# sourceMappingURL=butler-webhook.handler.js.map