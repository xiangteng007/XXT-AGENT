"use strict";
/**
 * Telegram Command Implementations (V3 Audit #1)
 *
 * Extracted from telegram-webhook.handler.ts
 * Contains all /command handlers and menu builders.
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
exports.handleCommand = handleCommand;
exports.sendWelcomeMessage = sendWelcomeMessage;
exports.sendHelpMessage = sendHelpMessage;
exports.sendStockPrice = sendStockPrice;
exports.sendMonthlyReport = sendMonthlyReport;
exports.sendMainMenu = sendMainMenu;
exports.sendExpenseMenu = sendExpenseMenu;
exports.sendTodaySchedule = sendTodaySchedule;
exports.sendSettingsMenu = sendSettingsMenu;
exports.sendLinkInstructions = sendLinkInstructions;
exports.sendHealthSnapshot = sendHealthSnapshot;
exports.sendVehicleStatus = sendVehicleStatus;
exports.sendBalanceInfo = sendBalanceInfo;
exports.sendInvestmentSummary = sendInvestmentSummary;
exports.sendLoanSummary = sendLoanSummary;
exports.sendTaxEstimation = sendTaxEstimation;
exports.sendFinancialAdvice = sendFinancialAdvice;
exports.sendAgentsDirectory = sendAgentsDirectory;
exports.sendDiscussMenu = sendDiscussMenu;
exports.runMultiAgentDiscussion = runMultiAgentDiscussion;
exports.sendReflectTrigger = sendReflectTrigger;
exports.sendMemoryStatus = sendMemoryStatus;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const api_1 = require("./api");
const conversation_session_service_1 = require("../../services/butler/conversation-session.service");
const local_inference_service_1 = require("../../services/local-inference.service");
const mpe_commands_1 = require("./mpe-commands");
const investment_service_1 = require("../../services/butler/investment.service");
const loan_service_1 = require("../../services/butler/loan.service");
const monthly_insights_service_1 = require("../../services/butler/monthly-insights.service");
const tax_service_1 = require("../../services/butler/tax.service");
const db = (0, firestore_1.getFirestore)();
// ================================
// Command Router
// ================================
async function handleCommand(chatId, telegramUserId, text) {
    const [command] = text.split(' ');
    const commandName = command.replace(/@\w+$/, '').toLowerCase();
    switch (commandName) {
        case '/start':
            await sendWelcomeMessage(chatId);
            break;
        case '/help':
            await sendHelpMessage(chatId);
            break;
        case '/menu':
            await sendMainMenu(chatId);
            break;
        case '/today':
            await sendTodaySchedule(chatId, telegramUserId);
            break;
        case '/expense':
            await sendExpenseMenu(chatId);
            break;
        case '/health':
            await sendHealthSnapshot(chatId, telegramUserId);
            break;
        case '/car':
            await sendVehicleStatus(chatId, telegramUserId);
            break;
        case '/balance':
            await sendBalanceInfo(chatId, telegramUserId);
            break;
        case '/invest':
            await sendInvestmentSummary(chatId, telegramUserId);
            break;
        case '/loan':
            await sendLoanSummary(chatId, telegramUserId);
            break;
        case '/tax':
            await sendTaxEstimation(chatId, telegramUserId);
            break;
        case '/advice':
            await sendFinancialAdvice(chatId, telegramUserId);
            break;
        case '/price':
            await sendStockPrice(chatId, text);
            break;
        case '/report':
            await sendMonthlyReport(chatId, telegramUserId);
            break;
        case '/link':
            await sendLinkInstructions(chatId, telegramUserId);
            break;
        case '/settings':
            await sendSettingsMenu(chatId);
            break;
        case '/agents':
            await sendAgentsDirectory(chatId, telegramUserId);
            break;
        case '/discuss':
            await sendDiscussMenu(chatId, telegramUserId, text);
            break;
        case '/reflect':
            await sendReflectTrigger(chatId, telegramUserId);
            break;
        case '/memory':
            await sendMemoryStatus(chatId, telegramUserId);
            break;
        // ── MPE Market Prediction Engine ──
        case '/signal':
            await (0, mpe_commands_1.handleSignalCommand)({ reply: (t, o) => (0, api_1.sendMessage)(chatId, t, o) });
            break;
        case '/mpe':
            await (0, mpe_commands_1.handleMpeCommand)({ reply: (t, o) => (0, api_1.sendMessage)(chatId, t, o) });
            break;
        case '/predict':
            await (0, mpe_commands_1.handlePredictCommand)({ message: { text }, reply: (t, o) => (0, api_1.sendMessage)(chatId, t, o) });
            break;
        case '/backtest':
            await (0, mpe_commands_1.handleBacktestCommand)({ message: { text }, reply: (t, o) => (0, api_1.sendMessage)(chatId, t, o) });
            break;
        default:
            await (0, api_1.sendMessage)(chatId, '❓ 不認識的指令。輸入 /help 查看可用指令。');
    }
}
// ================================
// Core Commands
// ================================
async function sendWelcomeMessage(chatId) {
    const welcome = `👋 您好！我是 XXT-AGENT 小秘書！

我是您的專屬 AI 智能管家，可以幫助您：

📋 **行程管理** - 查看今日行程、新增事件
💰 **快速記帳** - 一鍵記錄支出
📈 **投資理財** - 投資組合、貸款、稅務
🤖 **理財顧問** - AI 個人化財務建議
🏃 **健康追蹤** - BMI、運動記錄
🚗 **車輛管理** - 油耗、保養提醒

直接用自然語言告訴我您的需求！

💡 試試看說：「買了 10 張 0050，均價 150」`;
    await (0, api_1.sendMessage)(chatId, welcome, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📋 今日行程', callback_data: 'cmd_today' },
                    { text: '💰 快速記帳', callback_data: 'cmd_expense' },
                ],
                [
                    { text: '📈 投資組合', callback_data: 'cmd_invest' },
                    { text: '🤖 理財顧問', callback_data: 'cmd_advice' },
                ],
                [{ text: '🔗 綁定帳號', callback_data: 'cmd_link' }],
            ],
        },
    });
}
async function sendHelpMessage(chatId) {
    const help = `📖 **XXT-AGENT 小秘書使用說明**

**指令列表：**
/menu - 主選單
/today - 今日行程
/expense - 快速記帳
/invest - 投資組合
/loan - 貸款管理
/tax - 稅務估算
/advice - 理財顧問
/price 2330 - 查股價
/report - 月度報告
/health - 健康快照
/car - 車輛狀態
/balance - 帳戶餘額
/link - 綁定帳號
/settings - 設定
/agents - 探員目錄
/mpe - 市場預測引擎狀態
/signal - 今日交易訊號
/predict [代號] - 即時分析（如 /predict 2330）
/backtest [代號] - 歷史訊號準確率

**自然語言（AI 理財）：**
• 「買了 10 張 0050，均價 150」
• 「房貸 800 萬、利率 2.1%、30 年」
• 「年薪 120 萬，估算稅額」
• 「給我理財建議」
• 「這個月花了多少」`;
    await (0, api_1.sendMessage)(chatId, help);
}
async function sendStockPrice(chatId, text) {
    const parts = text.trim().split(/\s+/);
    const symbols = parts.slice(1).filter(s => s.length > 0);
    if (symbols.length === 0) {
        await (0, api_1.sendMessage)(chatId, '📈 用法：/price 2330 或 /price AAPL TSLA\n\n例如：\n• `/price 2330` — 台積電\n• `/price AAPL` — Apple\n• `/price 0050 2454` — 多檔查詢');
        return;
    }
    await (0, api_1.sendChatAction)(chatId, 'typing');
    try {
        const results = [];
        for (const sym of symbols.slice(0, 5)) {
            const isTW = /^\d{4,6}$/.test(sym);
            let msg = '';
            if (isTW) {
                const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${sym}.tw`;
                const resp = await fetch(url, { headers: { 'User-Agent': 'XXT-AGENT/1.0' } });
                if (resp.ok) {
                    const data = await resp.json();
                    const q = data.msgArray?.[0];
                    if (q) {
                        const price = parseFloat(q.z) || parseFloat(q.y) || 0;
                        const prev = parseFloat(q.y) || 0;
                        const change = price - prev;
                        const pct = prev ? ((change / prev) * 100).toFixed(2) : '0.00';
                        const arrow = change > 0 ? '🔴 ▲' : change < 0 ? '🟢 ▼' : '⚪';
                        msg = `${arrow} **${q.n}** (${q.c})\n💰 $${price.toFixed(2)}  ${change > 0 ? '+' : ''}${change.toFixed(2)} (${pct}%)\n📊 成交量: ${parseInt(q.v).toLocaleString()} 張`;
                    }
                }
            }
            else {
                const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${sym.toUpperCase()}&range=1d&interval=1d`;
                const resp = await fetch(url, { headers: { 'User-Agent': 'XXT-AGENT/1.0' } });
                if (resp.ok) {
                    const data = await resp.json();
                    const m = data.spark?.result?.[0]?.response?.[0]?.meta;
                    if (m) {
                        const change = m.regularMarketPrice - m.previousClose;
                        const pct = ((change / m.previousClose) * 100).toFixed(2);
                        const arrow = change > 0 ? '🔴 ▲' : change < 0 ? '🟢 ▼' : '⚪';
                        msg = `${arrow} **${sym.toUpperCase()}**\n💰 $${m.regularMarketPrice.toFixed(2)}  ${change > 0 ? '+' : ''}${change.toFixed(2)} (${pct}%)\n📊 Volume: ${(m.regularMarketVolume || 0).toLocaleString()}`;
                    }
                }
            }
            results.push(msg || `❌ 查無 ${sym} 的股價資料`);
        }
        await (0, api_1.sendMessage)(chatId, results.join('\n\n'));
    }
    catch (error) {
        v2_1.logger.error('[Telegram] Stock price error:', error);
        await (0, api_1.sendMessage)(chatId, '❌ 股價查詢失敗，請稍後再試。');
    }
}
async function sendMonthlyReport(chatId, telegramUserId) {
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    if (!linkedUid) {
        await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號才能使用月報功能。\n\n使用 /link 開始綁定。');
        return;
    }
    await (0, api_1.sendChatAction)(chatId, 'typing');
    await (0, api_1.sendMessage)(chatId, '📊 正在生成月度報告...');
    try {
        const report = await (0, monthly_insights_service_1.generateMonthlyInsights)(linkedUid);
        let msg = `📊 **${report.month} 月度報告**\n\n`;
        for (const section of report.sections) {
            msg += `${section.icon} **${section.title}**\n`;
            for (const item of section.items) {
                msg += `  • ${item}\n`;
            }
            msg += '\n';
        }
        msg += `📝 ${report.summary}`;
        await (0, api_1.sendMessage)(chatId, msg, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💰 查看支出明細', callback_data: 'cmd_balance' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
    catch (error) {
        v2_1.logger.error('[Telegram] Monthly report error:', error);
        await (0, api_1.sendMessage)(chatId, '❌ 月報生成失敗，請稍後再試。');
    }
}
// ================================
// Menu Commands
// ================================
async function sendMainMenu(chatId) {
    await (0, api_1.sendMessage)(chatId, '🏠 **主選單** - 請選擇功能：', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📋 今日行程', callback_data: 'cmd_today' },
                    { text: '💰 快速記帳', callback_data: 'cmd_expense' },
                ],
                [
                    { text: '📈 投資組合', callback_data: 'cmd_invest' },
                    { text: '🏦 貸款管理', callback_data: 'cmd_loan' },
                ],
                [
                    { text: '📋 稅務估算', callback_data: 'cmd_tax' },
                    { text: '🤖 理財顧問', callback_data: 'cmd_advice' },
                ],
                [
                    { text: '🏃 健康快照', callback_data: 'cmd_health' },
                    { text: '🚗 車輛狀態', callback_data: 'cmd_car' },
                ],
                [
                    { text: '💳 帳戶餘額', callback_data: 'cmd_balance' },
                    { text: '⚙️ 設定', callback_data: 'cmd_settings' },
                ],
                [
                    { text: '🔮 市場預測 MPE', callback_data: 'cmd_mpe' },
                    { text: '📡 交易訊號', callback_data: 'cmd_signal' },
                ],
            ],
        },
    });
}
async function sendExpenseMenu(chatId) {
    await (0, api_1.sendMessage)(chatId, '💰 **記帳** - 請選擇支出分類：', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🍔 餐飲', callback_data: 'expense_food' },
                    { text: '🚗 交通', callback_data: 'expense_transport' },
                ],
                [
                    { text: '🛒 購物', callback_data: 'expense_shopping' },
                    { text: '🎮 娛樂', callback_data: 'expense_entertainment' },
                ],
                [
                    { text: '🏠 居住', callback_data: 'expense_housing' },
                    { text: '📱 其他', callback_data: 'expense_other' },
                ],
                [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
            ],
        },
    });
}
async function sendTodaySchedule(chatId, telegramUserId) {
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    if (!linkedUid) {
        await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號才能查看行程。\n\n使用 /link 開始綁定。');
        return;
    }
    const today = new Date().toLocaleDateString('zh-TW', { weekday: 'long', month: 'long', day: 'numeric' });
    await (0, api_1.sendMessage)(chatId, `📅 **${today}**\n\n暫無行程安排。\n\n💡 直接輸入「新增下午2點開會」來建立事件。`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ 新增事件', callback_data: 'add_event' }],
                [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
            ],
        },
    });
}
async function sendSettingsMenu(chatId) {
    await (0, api_1.sendMessage)(chatId, '⚙️ **設定**\n\n請選擇要調整的項目：', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔗 帳號綁定', callback_data: 'cmd_link' }],
                [{ text: '🔔 通知設定', callback_data: 'settings_notifications' }],
                [{ text: '🌐 語言', callback_data: 'settings_language' }],
                [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
            ],
        },
    });
}
async function sendLinkInstructions(chatId, telegramUserId) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = firestore_1.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));
    await db.collection('telegram_link_codes').doc(code).set({
        telegramUserId, code, expiresAt, used: false, createdAt: firestore_1.Timestamp.now(),
    });
    await (0, api_1.sendMessage)(chatId, `🔗 **帳號綁定**

請在 XXT-AGENT Dashboard 的設定頁面輸入以下驗證碼：

\`${code}\`

⏰ 驗證碼有效期限：10 分鐘

📱 Dashboard: https://xxt-agent.vercel.app/settings/link`);
}
// ================================
// Data Commands (Health, Vehicle, Balance)
// ================================
async function sendHealthSnapshot(chatId, telegramUserId) {
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    if (!linkedUid) {
        await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號才能查看健康數據。\n\n使用 /link 開始綁定。');
        return;
    }
    try {
        const profileDoc = await db.doc(`users/${linkedUid}/butler/profile`).get();
        const profile = profileDoc.data()?.userProfile || {};
        const weight = profile.weight || 81.8;
        const height = profile.height || 170;
        const age = profile.age || 40;
        const gender = profile.gender || 'male';
        const bmi = Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10;
        const bmr = gender === 'male'
            ? Math.round(88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age))
            : Math.round(447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age));
        let bmiCategory;
        let bmiEmoji;
        if (bmi < 18.5) {
            bmiCategory = '過輕';
            bmiEmoji = '⚠️';
        }
        else if (bmi < 24) {
            bmiCategory = '正常';
            bmiEmoji = '✅';
        }
        else if (bmi < 27) {
            bmiCategory = '過重';
            bmiEmoji = '⚠️';
        }
        else {
            bmiCategory = '肥胖';
            bmiEmoji = '🔴';
        }
        const today = new Date().toISOString().split('T')[0];
        const todayDoc = await db.doc(`users/${linkedUid}/butler/health/daily/${today}`).get();
        const todayData = todayDoc.data() || {};
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const weekSnapshot = await db.collection(`users/${linkedUid}/butler/health/daily`)
            .where('date', '>=', weekStart.toISOString().split('T')[0]).get();
        const weeklySteps = weekSnapshot.docs.reduce((sum, doc) => sum + (doc.data().steps || 0), 0);
        const weeklyActive = weekSnapshot.docs.reduce((sum, doc) => sum + (doc.data().activeMinutes || 0), 0);
        const weeklyCalories = weekSnapshot.docs.reduce((sum, doc) => sum + (doc.data().caloriesBurned || 0), 0);
        const message = `🏃 **健康快照**

📊 **身體指標**
• 體重: ${weight} kg
• BMI: ${bmiEmoji} ${bmi} (${bmiCategory})
• BMR: ${bmr} kcal/天

📅 **今日進度**
• 步數: ${todayData.steps?.toLocaleString() || 0} / 8,000
• 活動: ${todayData.activeMinutes || 0} / 30 分鐘
• 熱量: ${todayData.caloriesBurned || 0} kcal

📈 **本週統計** (${weekSnapshot.size} 天記錄)
• 總步數: ${weeklySteps.toLocaleString()}
• 活動時間: ${weeklyActive} 分鐘
• 燃燒熱量: ${weeklyCalories} kcal

💡 *提示: 每日建議至少 30 分鐘中等強度運動*`;
        await (0, api_1.sendMessage)(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📝 記錄體重', callback_data: 'health_weight' }],
                    [{ text: '🏋️ 記錄運動', callback_data: 'health_workout' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
    catch (error) {
        v2_1.logger.error('[Telegram] Health snapshot error:', error);
        await (0, api_1.sendMessage)(chatId, '❌ 無法載入健康數據，請稍後再試。', {
            reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
        });
    }
}
async function sendVehicleStatus(chatId, telegramUserId) {
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    if (!linkedUid) {
        await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號才能查看車輛狀態。\n\n使用 /link 開始綁定。');
        return;
    }
    try {
        const vehicleSnapshot = await db.collection(`users/${linkedUid}/butler/vehicles`).limit(1).get();
        if (vehicleSnapshot.empty) {
            await (0, api_1.sendMessage)(chatId, '🚗 **車輛管理**\n\n尚未設定車輛資料。\n\n請在 Dashboard 新增您的車輛。', {
                reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
            });
            return;
        }
        const vehicleDoc = vehicleSnapshot.docs[0];
        const vehicle = vehicleDoc.data();
        const fuelSnapshot = await db.collection(`users/${linkedUid}/butler/vehicles/${vehicleDoc.id}/fuelLogs`).orderBy('date', 'desc').limit(5).get();
        let avgKmPerLiter = 0;
        let totalCost = 0;
        if (!fuelSnapshot.empty) {
            const fuelLogs = fuelSnapshot.docs.map(d => d.data());
            const totalLiters = fuelLogs.reduce((sum, log) => sum + (log.liters || 0), 0);
            const totalKm = fuelLogs.length > 1 ? fuelLogs[0].mileage - fuelLogs[fuelLogs.length - 1].mileage : 0;
            avgKmPerLiter = totalKm > 0 ? Math.round((totalKm / totalLiters) * 10) / 10 : 0;
            totalCost = fuelLogs.reduce((sum, log) => sum + (log.totalCost || log.liters * log.pricePerLiter || 0), 0);
        }
        const maintenanceItems = [];
        const now = new Date();
        if (vehicle.insuranceExpiry) {
            const d = Math.ceil((new Date(vehicle.insuranceExpiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (d <= 30)
                maintenanceItems.push(`⚠️ 保險到期: ${d} 天後`);
        }
        if (vehicle.inspectionExpiry) {
            const d = Math.ceil((new Date(vehicle.inspectionExpiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (d <= 30)
                maintenanceItems.push(`⚠️ 驗車到期: ${d} 天後`);
        }
        const lastServiceMileage = vehicle.lastOilChangeMileage || vehicle.currentMileage - 3000;
        const kmUntilOilChange = 5000 - (vehicle.currentMileage - lastServiceMileage);
        if (kmUntilOilChange <= 1000)
            maintenanceItems.push(`🔧 機油更換: 還剩 ${kmUntilOilChange} km`);
        const make = vehicle.make || 'Suzuki';
        const model = vehicle.model || 'Jimny';
        const variant = vehicle.variant || 'JB74';
        const message = `🚗 **車輛狀態**

🚙 **${make} ${model} ${variant}**
• 車牌: ${vehicle.licensePlate || 'N/A'}
• 里程: ${vehicle.currentMileage?.toLocaleString() || 0} km

⛽ **油耗統計** (近 ${fuelSnapshot.size} 筆)
• 平均油耗: ${avgKmPerLiter} km/L
• 近期油費: $${Math.round(totalCost).toLocaleString()}

${maintenanceItems.length > 0 ? '📋 **待辦提醒**\n' + maintenanceItems.join('\n') : '✅ **無緊急待辦事項**'}

💡 *Jimny JB74 原廠油耗約 15 km/L*`;
        await (0, api_1.sendMessage)(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⛽ 記錄加油', callback_data: 'vehicle_fuel' }],
                    [{ text: '🔧 記錄保養', callback_data: 'vehicle_service' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
    catch (error) {
        v2_1.logger.error('[Telegram] Vehicle status error:', error);
        await (0, api_1.sendMessage)(chatId, '❌ 無法載入車輛數據，請稍後再試。', {
            reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
        });
    }
}
async function sendBalanceInfo(chatId, telegramUserId) {
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    if (!linkedUid) {
        await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號才能查看財務資訊。\n\n使用 /link 開始綁定。');
        return;
    }
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = now.toISOString().split('T')[0];
        const transactionSnapshot = await db.collection(`users/${linkedUid}/butler/finance/transactions`)
            .where('date', '>=', startDate).where('date', '<=', endDate).get();
        let totalIncome = 0;
        let totalExpenses = 0;
        const categoryTotals = {};
        transactionSnapshot.docs.forEach(doc => {
            const tx = doc.data();
            if (tx.type === 'income')
                totalIncome += tx.amount || 0;
            else if (tx.type === 'expense') {
                totalExpenses += tx.amount || 0;
                const cat = tx.category || '其他';
                categoryTotals[cat] = (categoryTotals[cat] || 0) + tx.amount;
            }
        });
        const netSavings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
        const topCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a).slice(0, 3);
        const topCategoriesText = topCategories.length > 0
            ? topCategories.map(([cat, amt]) => `• ${cat}: $${amt.toLocaleString()}`).join('\n')
            : '• 本月尚無支出記錄';
        const monthName = `${year}年${month}月`;
        const message = `💳 **財務概況** - ${monthName}

💰 **本月收支**
• 收入: $${totalIncome.toLocaleString()}
• 支出: $${totalExpenses.toLocaleString()}
• 結餘: $${netSavings >= 0 ? '+' : ''}${netSavings.toLocaleString()}
• 儲蓄率: ${savingsRate}%

📊 **支出前三名**
${topCategoriesText}

📝 **交易筆數**: ${transactionSnapshot.size} 筆

💡 *建議儲蓄率維持在 20% 以上*`;
        await (0, api_1.sendMessage)(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💰 快速記帳', callback_data: 'cmd_expense' }],
                    [{ text: '📊 完整報表', callback_data: 'finance_report' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
    catch (error) {
        v2_1.logger.error('[Telegram] Balance info error:', error);
        await (0, api_1.sendMessage)(chatId, '❌ 無法載入財務數據，請稍後再試。', {
            reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
        });
    }
}
// ================================
// Financial Advisory Commands
// ================================
async function sendInvestmentSummary(chatId, telegramUserId) {
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    if (!linkedUid) {
        await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號。使用 /link 開始。');
        return;
    }
    await (0, api_1.sendChatAction)(chatId, 'typing');
    try {
        const portfolio = await investment_service_1.investmentService.getPortfolioSummary(linkedUid);
        if (portfolio.holdingCount === 0) {
            await (0, api_1.sendMessage)(chatId, '📈 **投資組合**\n\n尚未建立投資組合。\n\n💡 直接輸入「買了 10 張 0050，均價 150」開始追蹤', {
                reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
            });
            return;
        }
        const holdingList = portfolio.holdings.slice(0, 8).map(h => `• ${h.symbol} ${h.name}: ${h.shares}股, 均價$${h.avgCost}`).join('\n');
        await (0, api_1.sendMessage)(chatId, `📈 **投資組合** (${portfolio.holdingCount} 檔)

💰 總市值: $${portfolio.totalMarketValue.toLocaleString()}
📉 未實現損益: ${portfolio.totalUnrealizedPnL >= 0 ? '+' : ''}$${portfolio.totalUnrealizedPnL.toLocaleString()} (${portfolio.returnRate}%)

**持倉明細:**
${holdingList}`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🤖 投資分析建議', callback_data: 'advice_topic_portfolio_review' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
    catch (err) {
        v2_1.logger.error('[Telegram] Investment summary error:', err);
        await (0, api_1.sendMessage)(chatId, '❌ 無法載入投資數據。');
    }
}
async function sendLoanSummary(chatId, telegramUserId) {
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    if (!linkedUid) {
        await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號。使用 /link 開始。');
        return;
    }
    await (0, api_1.sendChatAction)(chatId, 'typing');
    try {
        const summary = await loan_service_1.loanService.getLoanSummary(linkedUid);
        if (summary.loanCount === 0) {
            await (0, api_1.sendMessage)(chatId, '🏦 **貸款管理**\n\n無貸款記錄。\n\n💡 輸入「房貸 800 萬、利率 2.1%、30 年」開始試算', {
                reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
            });
            return;
        }
        const loanList = summary.loans.slice(0, 5).map(l => `• ${l.name}: $${l.remainingBalance.toLocaleString()} 剩餘 (月付$${l.monthlyPayment.toLocaleString()})`).join('\n');
        await (0, api_1.sendMessage)(chatId, `🏦 **貸款管理** (${summary.loanCount} 筆)

💳 總剩餘: $${summary.totalRemainingBalance.toLocaleString()}
💰 每月總繳: $${summary.totalMonthlyPayment.toLocaleString()}
📈 已償還比例: ${summary.paidOffPercentage}%

**貸款明細:**
${loanList}`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🤖 債務策略建議', callback_data: 'advice_topic_debt_strategy' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
    catch (err) {
        v2_1.logger.error('[Telegram] Loan summary error:', err);
        await (0, api_1.sendMessage)(chatId, '❌ 無法載入貸款數據。');
    }
}
async function sendTaxEstimation(chatId, telegramUserId) {
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    if (!linkedUid) {
        await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號。使用 /link 開始。');
        return;
    }
    await (0, api_1.sendChatAction)(chatId, 'typing');
    try {
        const profile = await tax_service_1.taxService.getTaxProfile(linkedUid);
        if (!profile) {
            await (0, api_1.sendMessage)(chatId, '📋 **稅務估算**\n\n尚未設定稅務資料。\n\n💡 輸入「年薪 120 萬，估算稅額」開始', {
                reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
            });
            return;
        }
        const est = tax_service_1.taxService.estimateIncomeTax(profile);
        let taxMsg = `📋 **稅務估算** (${est.year})

💰 綜合所得: $${est.grossIncome.toLocaleString()}
📋 應稅所得: $${est.taxableIncome.toLocaleString()}
💳 適用稅率: ${est.taxBracketRate}%
💵 預估稅額: $${est.estimatedTax.toLocaleString()}
📉 有效稅率: ${est.effectiveRate}%`;
        if (est.dividendAnalysis) {
            const da = est.dividendAnalysis;
            taxMsg += `\n\n📈 股利節稅: 建議「${da.recommendedMethod === 'combined' ? '合併計稅' : '分離課稅'}」，省$${da.savingsAmount.toLocaleString()}`;
        }
        await (0, api_1.sendMessage)(chatId, taxMsg, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🤖 稅務優化建議', callback_data: 'advice_topic_tax_optimization' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
    catch (err) {
        v2_1.logger.error('[Telegram] Tax estimation error:', err);
        await (0, api_1.sendMessage)(chatId, '❌ 無法計算稅務。');
    }
}
async function sendFinancialAdvice(chatId, telegramUserId) {
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    if (!linkedUid) {
        await (0, api_1.sendMessage)(chatId, '❌ 請先綁定帳號。使用 /link 開始。');
        return;
    }
    await (0, api_1.sendMessage)(chatId, `🤖 **AI 理財顧問**

請選擇您想瞭解的財務主題：`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📊 綜合報告', callback_data: 'advice_topic_comprehensive' }],
                [{ text: '📈 投資組合分析', callback_data: 'advice_topic_portfolio_review' }],
                [{ text: '🏦 債務策略', callback_data: 'advice_topic_debt_strategy' }],
                [{ text: '📋 稅務優化', callback_data: 'advice_topic_tax_optimization' }],
                [{ text: '🏖️ 退休規劃', callback_data: 'advice_topic_retirement_planning' }],
                [{ text: '🛡️ 緊急預備金', callback_data: 'advice_topic_emergency_fund' }],
                [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
            ],
        },
    });
}
async function sendAgentsDirectory(chatId, telegramUserId) {
    await (0, api_1.sendChatAction)(chatId, 'typing');
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    const userId = linkedUid || `telegram:${telegramUserId}`;
    let currentAgent = 'butler';
    try {
        const session = await (0, conversation_session_service_1.getSession)(userId);
        currentAgent = session.activeAgent || 'butler';
    }
    catch (err) {
        v2_1.logger.warn('[Telegram] getSession failed in sendAgentsDirectory:', err);
    }
    const msg = `🤖 **XXT-AGENT 探員目錄**

目前活躍探員：**${currentAgent.toUpperCase()}**

─────────────────
🏗️ *工程部門*
  • Titan - BIM/結構工程師
  • Lumi - 室內設計總管
  • Rusty - 估算/工務總管
  • Forge - 先進製造專家
  • Matter - 應用材料科學家
  • Nexus - AI 系統架構師

💼 *管理部門*
  • Nova - 人資與協調長
  • Accountant - 財務會計
  • Investment - 投資顧問
  • Apex - 行銷拓展
  • Vertex - 法務合規
  • Echo - 公關客服

🔐 *情報部門*
  • Argus - 全域情報官
  • Zenith - 永續 ESG
  • 小秘書 - 預設助理

💡 選擇探員後直接開始對話，AI 將以該專家角色回應。
🧠 使用 /discuss 讓探員們集體討論問題。`;
    await (0, api_1.sendMessage)(chatId, msg, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '👔 小秘書', callback_data: 'agent_switch_butler' },
                    { text: '🏛️ Titan', callback_data: 'agent_switch_titan' },
                ],
                [
                    { text: '✨ Lumi', callback_data: 'agent_switch_lumi' },
                    { text: '📐 Rusty', callback_data: 'agent_switch_rusty' },
                ],
                [
                    { text: '💰 Accountant', callback_data: 'agent_switch_accountant' },
                    { text: '🛡️ Argus', callback_data: 'agent_switch_argus' },
                ],
                [
                    { text: '👥 Nova', callback_data: 'agent_switch_nova' },
                    { text: '📈 Investment', callback_data: 'agent_switch_investment' },
                ],
                [
                    { text: '⚙️ Forge', callback_data: 'agent_switch_forge' },
                    { text: '☁️ Nexus', callback_data: 'agent_switch_nexus' },
                ],
                [
                    { text: '🧠 多 Agent 討論 /discuss', callback_data: 'cmd_discuss' },
                ],
                [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
            ],
        },
    });
}
// ================================
// Multi-Agent Discussion Engine
// ================================
async function sendDiscussMenu(chatId, telegramUserId, text) {
    const topic = text.replace(/^\/discuss\s*/, '').trim();
    if (topic) {
        await runMultiAgentDiscussion(chatId, telegramUserId, topic);
        return;
    }
    await (0, api_1.sendMessage)(chatId, `🧠 **多 Agent 集體討論**

讓各探員共同分析您的問題，提供多角度見解。

*使用方式：*
/discuss [您的問題]

*例如：*
• /discuss 我應該投資 TSMC 還是 NVDA？
• /discuss 這個建案的結構風險評估
• /discuss 如何優化人力配置？`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '← 返回探員目錄', callback_data: 'cmd_agents' }],
            ],
        },
    });
}
async function runMultiAgentDiscussion(chatId, telegramUserId, topic) {
    await (0, api_1.sendChatAction)(chatId, 'typing');
    await (0, api_1.sendMessage)(chatId, `🧠 **召集探員討論中...**\n\n主題：_${topic}_\n\n⏳ 整合各探員觀點，請稍候...`);
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    const userId = linkedUid || `telegram:${telegramUserId}`;
    const allAgents = [
        { id: 'titan', name: 'Titan', emoji: '🏛️', role: '建築/BIM工程師', keywords: ['建築', '結構', '工程', 'bim', '建案', '施工', '設計'] },
        { id: 'investment', name: 'Investment', emoji: '📈', role: '投資顧問', keywords: ['投資', '股票', '基金', 'etf', '理財', '資產', '報酬'] },
        { id: 'accountant', name: 'Accountant', emoji: '💰', role: '財務會計師', keywords: ['財務', '帳目', '稅務', '收支', '會計', '成本'] },
        { id: 'argus', name: 'Argus', emoji: '🛡️', role: '資安情報官', keywords: ['資安', '情報', '風險', '安全', '威脅', '調查'] },
        { id: 'nova', name: 'Nova', emoji: '👥', role: '人資協調長', keywords: ['人資', '人力', '組織', '招募', '薪資', '團隊'] },
        { id: 'nexus', name: 'Nexus', emoji: '☁️', role: 'AI系統架構師', keywords: ['系統', '架構', 'ai', '技術', '軟體', '平台', '自動化'] },
        { id: 'rusty', name: 'Rusty', emoji: '📐', role: '工務估算師', keywords: ['估算', '工務', '成本', '預算', '報價', '採購'] },
    ];
    const topicLower = topic.toLowerCase();
    let relevantAgents = allAgents.filter(a => a.keywords.some(k => topicLower.includes(k)));
    if (relevantAgents.length < 3) {
        const extras = allAgents.filter(a => !relevantAgents.some(r => r.id === a.id)).slice(0, 3 - relevantAgents.length);
        relevantAgents = [...relevantAgents, ...extras];
    }
    relevantAgents = relevantAgents.slice(0, 4);
    const { generateAIResponseWithTools } = await Promise.resolve().then(() => __importStar(require('../../services/butler-ai.service')));
    let history = [];
    try {
        history = await (0, conversation_session_service_1.getPreviousMessages)(userId);
    }
    catch (_) { /* ignore */ }
    let discussionText = `🧠 **探員集體討論**\n主題：_${topic}_\n\n`;
    for (const agent of relevantAgents) {
        try {
            const agentPrompt = `你是 ${agent.name}（${agent.role}）。就以下主題以你的專業角色提供簡潔見解（繁體中文，2-3句）：「${topic}」`;
            const response = await generateAIResponseWithTools(agentPrompt, userId, history.join('\n'), agent.id);
            const agentView = (response.text || '（暫無意見）').slice(0, 300);
            discussionText += `${agent.emoji} **${agent.name}（${agent.role}）：**\n${agentView}\n\n`;
        }
        catch (err) {
            v2_1.logger.warn(`[Discuss] Agent ${agent.id} failed:`, err);
            discussionText += `${agent.emoji} **${agent.name}：** ⚠️ 暫時無法回應\n\n`;
        }
    }
    discussionText += `──────────────────\n💡 以上為各探員初步見解。可繼續提問深入討論，或 /agents 切換單一探員對話。`;
    try {
        await (0, conversation_session_service_1.appendMessage)(userId, 'assistant', `[多 Agent 討論] ${topic}`);
    }
    catch (_) { /* ignore */ }
    await (0, api_1.sendMessage)(chatId, discussionText, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔄 反思與摘要 /reflect', callback_data: 'reflect_now' }],
                [{ text: '← 返回探員目錄', callback_data: 'cmd_agents' }],
            ],
        },
    });
}
async function sendReflectTrigger(chatId, telegramUserId) {
    await (0, api_1.sendChatAction)(chatId, 'typing');
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    const userId = linkedUid || `telegram:${telegramUserId}`;
    try {
        let history = [];
        try {
            history = await (0, conversation_session_service_1.getPreviousMessages)(userId);
        }
        catch (_) { /* ignore */ }
        if (history.length < 2) {
            await (0, api_1.sendMessage)(chatId, '💭 尚無足夠的對話記錄可供反思。\n\n請先與探員對話後再使用 /reflect。');
            return;
        }
        const { generateAIResponseWithTools } = await Promise.resolve().then(() => __importStar(require('../../services/butler-ai.service')));
        const reflectPrompt = `請根據以下對話，生成簡潔反思摘要（繁體中文）：
1. 主要討論的問題或任務
2. 各方提供的關鍵見解  
3. 已達成的結論或待辦事項
4. 下一步建議

對話歷史（最近10條）：
${history.slice(-10).join('\n')}`;
        const response = await generateAIResponseWithTools(reflectPrompt, userId, '', 'nexus');
        const reflection = response.text || '無法生成反思摘要。';
        await (0, api_1.sendMessage)(chatId, `🔄 **對話反思摘要**\n\n${reflection}\n\n─────────────────\n💾 摘要已記錄至會話歷史。`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
    catch (err) {
        v2_1.logger.error('[Telegram] Reflect error:', err);
        await (0, api_1.sendMessage)(chatId, '❌ 無法生成反思摘要，請稍後再試。');
    }
}
async function sendMemoryStatus(chatId, telegramUserId) {
    await (0, api_1.sendChatAction)(chatId, 'typing');
    const linkedUid = await (0, api_1.getLinkedFirebaseUid)(telegramUserId);
    const userId = linkedUid || `telegram:${telegramUserId}`;
    try {
        let currentAgent = 'butler';
        let messageCount = 0;
        let lastActive = '未知';
        try {
            const session = await (0, conversation_session_service_1.getSession)(userId);
            currentAgent = session.activeAgent || 'butler';
            if (session.lastActiveAt) {
                lastActive = new Date(session.lastActiveAt).toLocaleString('zh-TW');
            }
        }
        catch (_) { /* ignore */ }
        try {
            const history = await (0, conversation_session_service_1.getPreviousMessages)(userId);
            messageCount = history.length;
        }
        catch (_) { /* ignore */ }
        // Check local Ollama status
        const ollamaOnline = await (0, local_inference_service_1.isOllamaAvailable)();
        const ollamaModels = ollamaOnline ? await (0, local_inference_service_1.getAvailableModels)() : [];
        const ollamaStatus = ollamaOnline
            ? `✅ 運作中 (${ollamaModels.length > 0 ? ollamaModels.slice(0, 3).join(', ') : '模型載入中...'})`
            : '❌ 離線（雲端 fallback 啟動中）';
        // Dynamically check ChromaDB (NAS) status
        const { getMemorySystemStatus } = await Promise.resolve().then(() => __importStar(require('../../services/memory-store.service')));
        const memStatus = await getMemorySystemStatus();
        const chromaStatus = memStatus.chromaDbOnline
            ? `✅ 運作中 (${memStatus.chromaDbUrl})`
            : `❌ 離線 — fallback 至 Firestore (${memStatus.chromaDbUrl})`;
        const layerLabel = memStatus.layer === 'dual' ? '雙層模式' : 'Firestore 單層';
        const msg = `🧠 **記憶狀態**

👤 用戶 ID：\`${userId}\`
🤖 當前探員：**${currentAgent.toUpperCase()}**
💬 對話輪數：${messageCount} 條記錄
🕐 最後活躍：${lastActive}

─────────────────
*推理引擎狀態：*
🖥️ 本地 Ollama (RTX 4080)：${ollamaStatus}

─────────────────
*記憶層狀態（${layerLabel}）：*
☁️ Firestore 會話快取：✅ 運作中
📊 NAS ChromaDB 向量記憶：${chromaStatus}

💡 使用 /reflect 生成對話摘要並強化記憶。`;
        await (0, api_1.sendMessage)(chatId, msg, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 生成反思摘要', callback_data: 'reflect_now' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
    catch (err) {
        v2_1.logger.error('[Telegram] Memory status error:', err);
        await (0, api_1.sendMessage)(chatId, '❌ 無法取得記憶狀態，請稍後再試。');
    }
}
//# sourceMappingURL=commands.js.map