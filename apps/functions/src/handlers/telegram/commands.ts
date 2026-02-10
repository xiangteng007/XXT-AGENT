/**
 * Telegram Command Implementations (V3 Audit #1)
 * 
 * Extracted from telegram-webhook.handler.ts
 * Contains all /command handlers and menu builders.
 */

import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { sendMessage, sendChatAction, getLinkedFirebaseUid } from './api';

import { investmentService } from '../../services/butler/investment.service';
import { loanService } from '../../services/butler/loan.service';
import { generateMonthlyInsights } from '../../services/butler/monthly-insights.service';
import { taxService } from '../../services/butler/tax.service';


const db = getFirestore();

// ================================
// Command Router
// ================================

export async function handleCommand(chatId: number, telegramUserId: number, text: string): Promise<void> {
    const [command] = text.split(' ');
    const commandName = command.replace('@\\w+$', '').toLowerCase();

    switch (commandName) {
        case '/start': await sendWelcomeMessage(chatId); break;
        case '/help': await sendHelpMessage(chatId); break;
        case '/menu': await sendMainMenu(chatId); break;
        case '/today': await sendTodaySchedule(chatId, telegramUserId); break;
        case '/expense': await sendExpenseMenu(chatId); break;
        case '/health': await sendHealthSnapshot(chatId, telegramUserId); break;
        case '/car': await sendVehicleStatus(chatId, telegramUserId); break;
        case '/balance': await sendBalanceInfo(chatId, telegramUserId); break;
        case '/invest': await sendInvestmentSummary(chatId, telegramUserId); break;
        case '/loan': await sendLoanSummary(chatId, telegramUserId); break;
        case '/tax': await sendTaxEstimation(chatId, telegramUserId); break;
        case '/advice': await sendFinancialAdvice(chatId, telegramUserId); break;
        case '/price': await sendStockPrice(chatId, text); break;
        case '/report': await sendMonthlyReport(chatId, telegramUserId); break;
        case '/link': await sendLinkInstructions(chatId, telegramUserId); break;
        case '/settings': await sendSettingsMenu(chatId); break;
        default:
            await sendMessage(chatId, '❓ 不認識的指令。輸入 /help 查看可用指令。');
    }
}

// ================================
// Core Commands
// ================================

export async function sendWelcomeMessage(chatId: number): Promise<void> {
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

    await sendMessage(chatId, welcome, {
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

export async function sendHelpMessage(chatId: number): Promise<void> {
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

**自然語言（AI 理財）：**
• 「買了 10 張 0050，均價 150」
• 「房貸 800 萬、利率 2.1%、30 年」
• 「年薪 120 萬，估算稅額」
• 「給我理財建議」
• 「這個月花了多少」`;

    await sendMessage(chatId, help);
}

export async function sendStockPrice(chatId: number, text: string): Promise<void> {
    const parts = text.trim().split(/\s+/);
    const symbols = parts.slice(1).filter(s => s.length > 0);

    if (symbols.length === 0) {
        await sendMessage(chatId, '📈 用法：/price 2330 或 /price AAPL TSLA\n\n例如：\n• `/price 2330` — 台積電\n• `/price AAPL` — Apple\n• `/price 0050 2454` — 多檔查詢');
        return;
    }

    await sendChatAction(chatId, 'typing');

    try {
        const results: string[] = [];
        for (const sym of symbols.slice(0, 5)) {
            const isTW = /^\d{4,6}$/.test(sym);
            let msg = '';
            if (isTW) {
                const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${sym}.tw`;
                const resp = await fetch(url, { headers: { 'User-Agent': 'XXT-AGENT/1.0' } });
                if (resp.ok) {
                    const data = await resp.json() as { msgArray?: Array<{ c: string; n: string; z: string; y: string; o: string; h: string; l: string; v: string }> };
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
            } else {
                const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${sym.toUpperCase()}&range=1d&interval=1d`;
                const resp = await fetch(url, { headers: { 'User-Agent': 'XXT-AGENT/1.0' } });
                if (resp.ok) {
                    const data = await resp.json() as { spark?: { result?: Array<{ symbol: string; response: Array<{ meta: { regularMarketPrice: number; previousClose: number; regularMarketVolume: number } }> }> } };
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
        await sendMessage(chatId, results.join('\n\n'));
    } catch (error) {
        logger.error('[Telegram] Stock price error:', error);
        await sendMessage(chatId, '❌ 股價查詢失敗，請稍後再試。');
    }
}

export async function sendMonthlyReport(chatId: number, telegramUserId: number): Promise<void> {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) {
        await sendMessage(chatId, '❌ 請先綁定帳號才能使用月報功能。\n\n使用 /link 開始綁定。');
        return;
    }

    await sendChatAction(chatId, 'typing');
    await sendMessage(chatId, '📊 正在生成月度報告...');

    try {
        const report = await generateMonthlyInsights(linkedUid);
        let msg = `📊 **${report.month} 月度報告**\n\n`;
        for (const section of report.sections) {
            msg += `${section.icon} **${section.title}**\n`;
            for (const item of section.items) { msg += `  • ${item}\n`; }
            msg += '\n';
        }
        msg += `📝 ${report.summary}`;
        await sendMessage(chatId, msg, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💰 查看支出明細', callback_data: 'cmd_balance' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    } catch (error) {
        logger.error('[Telegram] Monthly report error:', error);
        await sendMessage(chatId, '❌ 月報生成失敗，請稍後再試。');
    }
}

// ================================
// Menu Commands
// ================================

export async function sendMainMenu(chatId: number): Promise<void> {
    await sendMessage(chatId, '🏠 **主選單** - 請選擇功能：', {
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
            ],
        },
    });
}

export async function sendExpenseMenu(chatId: number): Promise<void> {
    await sendMessage(chatId, '💰 **記帳** - 請選擇支出分類：', {
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

export async function sendTodaySchedule(chatId: number, telegramUserId: number): Promise<void> {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) {
        await sendMessage(chatId, '❌ 請先綁定帳號才能查看行程。\n\n使用 /link 開始綁定。');
        return;
    }
    const today = new Date().toLocaleDateString('zh-TW', { weekday: 'long', month: 'long', day: 'numeric' });
    await sendMessage(chatId, `📅 **${today}**\n\n暫無行程安排。\n\n💡 直接輸入「新增下午2點開會」來建立事件。`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ 新增事件', callback_data: 'add_event' }],
                [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
            ],
        },
    });
}

export async function sendSettingsMenu(chatId: number): Promise<void> {
    await sendMessage(chatId, '⚙️ **設定**\n\n請選擇要調整的項目：', {
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

export async function sendLinkInstructions(chatId: number, telegramUserId: number): Promise<void> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));
    await db.collection('telegram_link_codes').doc(code).set({
        telegramUserId, code, expiresAt, used: false, createdAt: Timestamp.now(),
    });
    await sendMessage(chatId, `🔗 **帳號綁定**

請在 XXT-AGENT Dashboard 的設定頁面輸入以下驗證碼：

\`${code}\`

⏰ 驗證碼有效期限：10 分鐘

📱 Dashboard: https://xxt-agent.vercel.app/settings/link`);
}

// ================================
// Data Commands (Health, Vehicle, Balance)
// ================================

export async function sendHealthSnapshot(chatId: number, telegramUserId: number): Promise<void> {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) {
        await sendMessage(chatId, '❌ 請先綁定帳號才能查看健康數據。\n\n使用 /link 開始綁定。');
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
        let bmiCategory: string;
        let bmiEmoji: string;
        if (bmi < 18.5) { bmiCategory = '過輕'; bmiEmoji = '⚠️'; }
        else if (bmi < 24) { bmiCategory = '正常'; bmiEmoji = '✅'; }
        else if (bmi < 27) { bmiCategory = '過重'; bmiEmoji = '⚠️'; }
        else { bmiCategory = '肥胖'; bmiEmoji = '🔴'; }
        
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
• 步數: ${(todayData as Record<string, number>).steps?.toLocaleString() || 0} / 8,000
• 活動: ${(todayData as Record<string, number>).activeMinutes || 0} / 30 分鐘
• 熱量: ${(todayData as Record<string, number>).caloriesBurned || 0} kcal

📈 **本週統計** (${weekSnapshot.size} 天記錄)
• 總步數: ${weeklySteps.toLocaleString()}
• 活動時間: ${weeklyActive} 分鐘
• 燃燒熱量: ${weeklyCalories} kcal

💡 *提示: 每日建議至少 30 分鐘中等強度運動*`;

        await sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📝 記錄體重', callback_data: 'health_weight' }],
                    [{ text: '🏋️ 記錄運動', callback_data: 'health_workout' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    } catch (error) {
        logger.error('[Telegram] Health snapshot error:', error);
        await sendMessage(chatId, '❌ 無法載入健康數據，請稍後再試。', {
            reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
        });
    }
}

export async function sendVehicleStatus(chatId: number, telegramUserId: number): Promise<void> {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) {
        await sendMessage(chatId, '❌ 請先綁定帳號才能查看車輛狀態。\n\n使用 /link 開始綁定。');
        return;
    }
    try {
        const vehicleSnapshot = await db.collection(`users/${linkedUid}/butler/vehicles`).limit(1).get();
        if (vehicleSnapshot.empty) {
            await sendMessage(chatId, '🚗 **車輛管理**\n\n尚未設定車輛資料。\n\n請在 Dashboard 新增您的車輛。', {
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
        const maintenanceItems: string[] = [];
        const now = new Date();
        if (vehicle.insuranceExpiry) {
            const d = Math.ceil((new Date(vehicle.insuranceExpiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (d <= 30) maintenanceItems.push(`⚠️ 保險到期: ${d} 天後`);
        }
        if (vehicle.inspectionExpiry) {
            const d = Math.ceil((new Date(vehicle.inspectionExpiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (d <= 30) maintenanceItems.push(`⚠️ 驗車到期: ${d} 天後`);
        }
        const lastServiceMileage = vehicle.lastOilChangeMileage || vehicle.currentMileage - 3000;
        const kmUntilOilChange = 5000 - (vehicle.currentMileage - lastServiceMileage);
        if (kmUntilOilChange <= 1000) maintenanceItems.push(`🔧 機油更換: 還剩 ${kmUntilOilChange} km`);
        
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

        await sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⛽ 記錄加油', callback_data: 'vehicle_fuel' }],
                    [{ text: '🔧 記錄保養', callback_data: 'vehicle_service' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    } catch (error) {
        logger.error('[Telegram] Vehicle status error:', error);
        await sendMessage(chatId, '❌ 無法載入車輛數據，請稍後再試。', {
            reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
        });
    }
}

export async function sendBalanceInfo(chatId: number, telegramUserId: number): Promise<void> {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) {
        await sendMessage(chatId, '❌ 請先綁定帳號才能查看財務資訊。\n\n使用 /link 開始綁定。');
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
        const categoryTotals: Record<string, number> = {};
        transactionSnapshot.docs.forEach(doc => {
            const tx = doc.data();
            if (tx.type === 'income') totalIncome += tx.amount || 0;
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

        await sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💰 快速記帳', callback_data: 'cmd_expense' }],
                    [{ text: '📊 完整報表', callback_data: 'finance_report' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    } catch (error) {
        logger.error('[Telegram] Balance info error:', error);
        await sendMessage(chatId, '❌ 無法載入財務數據，請稍後再試。', {
            reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
        });
    }
}

// ================================
// Financial Advisory Commands
// ================================

export async function sendInvestmentSummary(chatId: number, telegramUserId: number): Promise<void> {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) { await sendMessage(chatId, '❌ 請先綁定帳號。使用 /link 開始。'); return; }
    await sendChatAction(chatId, 'typing');
    try {
        const portfolio = await investmentService.getPortfolioSummary(linkedUid);
        if (portfolio.holdingCount === 0) {
            await sendMessage(chatId, '📈 **投資組合**\n\n尚未建立投資組合。\n\n💡 直接輸入「買了 10 張 0050，均價 150」開始追蹤', {
                reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
            });
            return;
        }
        const holdingList = portfolio.holdings.slice(0, 8).map(h =>
            `• ${h.symbol} ${h.name}: ${h.shares}股, 均價$${h.avgCost}`
        ).join('\n');
        await sendMessage(chatId, `📈 **投資組合** (${portfolio.holdingCount} 檔)

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
    } catch (err) {
        logger.error('[Telegram] Investment summary error:', err);
        await sendMessage(chatId, '❌ 無法載入投資數據。');
    }
}

export async function sendLoanSummary(chatId: number, telegramUserId: number): Promise<void> {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) { await sendMessage(chatId, '❌ 請先綁定帳號。使用 /link 開始。'); return; }
    await sendChatAction(chatId, 'typing');
    try {
        const summary = await loanService.getLoanSummary(linkedUid);
        if (summary.loanCount === 0) {
            await sendMessage(chatId, '🏦 **貸款管理**\n\n無貸款記錄。\n\n💡 輸入「房貸 800 萬、利率 2.1%、30 年」開始試算', {
                reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
            });
            return;
        }
        const loanList = summary.loans.slice(0, 5).map(l =>
            `• ${l.name}: $${l.remainingBalance.toLocaleString()} 剩餘 (月付$${l.monthlyPayment.toLocaleString()})`
        ).join('\n');
        await sendMessage(chatId, `🏦 **貸款管理** (${summary.loanCount} 筆)

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
    } catch (err) {
        logger.error('[Telegram] Loan summary error:', err);
        await sendMessage(chatId, '❌ 無法載入貸款數據。');
    }
}

export async function sendTaxEstimation(chatId: number, telegramUserId: number): Promise<void> {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) { await sendMessage(chatId, '❌ 請先綁定帳號。使用 /link 開始。'); return; }
    await sendChatAction(chatId, 'typing');
    try {
        const profile = await taxService.getTaxProfile(linkedUid);
        if (!profile) {
            await sendMessage(chatId, '📋 **稅務估算**\n\n尚未設定稅務資料。\n\n💡 輸入「年薪 120 萬，估算稅額」開始', {
                reply_markup: { inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]] },
            });
            return;
        }
        const est = taxService.estimateIncomeTax(profile);
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
        await sendMessage(chatId, taxMsg, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🤖 稅務優化建議', callback_data: 'advice_topic_tax_optimization' }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    } catch (err) {
        logger.error('[Telegram] Tax estimation error:', err);
        await sendMessage(chatId, '❌ 無法計算稅務。');
    }
}

export async function sendFinancialAdvice(chatId: number, telegramUserId: number): Promise<void> {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) { await sendMessage(chatId, '❌ 請先綁定帳號。使用 /link 開始。'); return; }
    await sendMessage(chatId, `🤖 **AI 理財顧問**

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
