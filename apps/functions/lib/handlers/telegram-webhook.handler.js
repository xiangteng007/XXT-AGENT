"use strict";
/**
 * Telegram Webhook Handler
 *
 * Handles incoming Telegram Bot API updates for the XXT-AGENT Personal Butler System.
 * Provides the same core functionality as the LINE Bot but with Telegram-specific features.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTelegramWebhook = handleTelegramWebhook;
// Removed unused crypto import
const butler_ai_service_1 = require("../services/butler-ai.service");
const firestore_1 = require("firebase-admin/firestore");
// Telegram Bot Token from environment
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Validate required environment variables at startup
if (!BOT_TOKEN) {
    console.error('CRITICAL: TELEGRAM_BOT_TOKEN must be set');
}
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const db = (0, firestore_1.getFirestore)();
// ================================
// Main Handler
// ================================
async function handleTelegramWebhook(req, res) {
    console.log('[Telegram Webhook] Received update');
    // Fast ACK - respond immediately
    res.status(200).send('OK');
    try {
        const update = req.body;
        if (update.message) {
            await handleMessage(update.message);
        }
        else if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
        }
    }
    catch (error) {
        console.error('[Telegram Webhook] Error processing update:', error);
    }
}
// ================================
// Message Handling
// ================================
async function handleMessage(message) {
    const chatId = message.chat.id;
    const telegramUserId = message.from.id;
    const text = message.text || '';
    console.log(`[Telegram] Message from ${telegramUserId}: ${text}`);
    // Check if it's a command
    if (text.startsWith('/')) {
        await handleCommand(chatId, telegramUserId, text);
        return;
    }
    // Natural language processing via AI
    await handleNaturalLanguage(chatId, telegramUserId, text);
}
async function handleCommand(chatId, telegramUserId, text) {
    const [command] = text.split(' ');
    const commandName = command.replace('@\\w+$', '').toLowerCase();
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
        case '/link':
            await sendLinkInstructions(chatId, telegramUserId);
            break;
        case '/settings':
            await sendSettingsMenu(chatId);
            break;
        default:
            await sendMessage(chatId, '❓ 不認識的指令。輸入 /help 查看可用指令。');
    }
}
async function handleNaturalLanguage(chatId, telegramUserId, text) {
    // Check if user is linked
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    // Show typing indicator
    await sendChatAction(chatId, 'typing');
    // Generate AI response
    const response = await (0, butler_ai_service_1.generateAIResponse)(text, linkedUid || `telegram:${telegramUserId}`);
    await sendMessage(chatId, response);
}
// ================================
// Command Implementations
// ================================
async function sendWelcomeMessage(chatId) {
    const welcome = `👋 您好！我是 XXT-AGENT 小秘書！

我是您的專屬 AI 智能管家，可以幫助您：

📋 **行程管理** - 查看今日行程、新增事件
💰 **快速記帳** - 一鍵記錄支出
🏃 **健康追蹤** - BMI、運動記錄
🚗 **車輛管理** - 油耗、保養提醒

點擊下方選單開始使用，或直接用自然語言告訴我您的需求！

💡 試試看說：「今天花了 150 元吃午餐」`;
    await sendMessage(chatId, welcome, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📋 今日行程', callback_data: 'cmd_today' }],
                [{ text: '💰 快速記帳', callback_data: 'cmd_expense' }],
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
/health - 健康快照
/car - 車輛狀態
/balance - 帳戶餘額
/link - 綁定帳號
/settings - 設定

**自然語言：**
直接輸入文字，AI 會理解您的意圖！

例如：
• 「今天行程」
• 「這個月花了多少」
• 「車子該保養了嗎」`;
    await sendMessage(chatId, help);
}
async function sendMainMenu(chatId) {
    await sendMessage(chatId, '🏠 **主選單** - 請選擇功能：', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📋 今日行程', callback_data: 'cmd_today' },
                    { text: '💰 快速記帳', callback_data: 'cmd_expense' },
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
async function sendExpenseMenu(chatId) {
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
async function sendTodaySchedule(chatId, telegramUserId) {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) {
        await sendMessage(chatId, '❌ 請先綁定帳號才能查看行程。\n\n使用 /link 開始綁定。');
        return;
    }
    // TODO: Fetch from schedule.service
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
async function sendHealthSnapshot(chatId, _telegramUserId) {
    // TODO: Implement with health.service
    await sendMessage(chatId, '🏃 **健康快照**\n\n功能開發中...', {
        reply_markup: {
            inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]],
        },
    });
}
async function sendVehicleStatus(chatId, _telegramUserId) {
    // TODO: Implement with vehicle.service
    await sendMessage(chatId, '🚗 **車輛狀態**\n\n功能開發中...', {
        reply_markup: {
            inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]],
        },
    });
}
async function sendBalanceInfo(chatId, _telegramUserId) {
    // TODO: Implement with finance.service
    await sendMessage(chatId, '💳 **帳戶資訊**\n\n功能開發中...', {
        reply_markup: {
            inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]],
        },
    });
}
async function sendLinkInstructions(chatId, telegramUserId) {
    // Generate a 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = firestore_1.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)); // 10 minutes
    // Store in Firestore
    await db.collection('telegram_link_codes').doc(code).set({
        telegramUserId,
        code,
        expiresAt,
        used: false,
        createdAt: firestore_1.Timestamp.now(),
    });
    await sendMessage(chatId, `🔗 **帳號綁定**

請在 XXT-AGENT Dashboard 的設定頁面輸入以下驗證碼：

\`${code}\`

⏰ 驗證碼有效期限：10 分鐘

📱 Dashboard: https://xxt-agent.vercel.app/settings/link`);
}
async function sendSettingsMenu(chatId) {
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
// ================================
// Callback Query Handling
// ================================
async function handleCallbackQuery(query) {
    const chatId = query.message?.chat.id;
    const data = query.data;
    if (!chatId || !data)
        return;
    // Answer callback query (removes loading state)
    await answerCallbackQuery(query.id);
    // Handle callback data
    if (data.startsWith('cmd_')) {
        const command = '/' + data.replace('cmd_', '');
        await handleCommand(chatId, query.from.id, command);
    }
    else if (data.startsWith('expense_')) {
        const category = data.replace('expense_', '');
        await handleExpenseCategory(chatId, query.from.id, category);
    }
    else if (data === 'add_event') {
        await sendMessage(chatId, '📝 請直接輸入事件內容，例如：\n\n「下午2點開會」\n「明天10點看醫生」');
    }
}
async function handleExpenseCategory(chatId, telegramUserId, category) {
    // Store the selected category in session
    await db.collection('telegram_sessions').doc(telegramUserId.toString()).set({
        state: 'awaiting_expense_amount',
        category,
        updatedAt: firestore_1.Timestamp.now(),
    }, { merge: true });
    const categoryNames = {
        food: '🍔 餐飲',
        transport: '🚗 交通',
        shopping: '🛒 購物',
        entertainment: '🎮 娛樂',
        housing: '🏠 居住',
        other: '📱 其他',
    };
    await sendMessage(chatId, `已選擇：${categoryNames[category] || category}\n\n請輸入金額（數字）：`);
}
// ================================
// Telegram API Helpers
// ================================
async function sendMessage(chatId, text, options) {
    try {
        const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'Markdown',
                ...options,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            console.error('[Telegram] Send message failed:', error);
        }
    }
    catch (error) {
        console.error('[Telegram] Send message error:', error);
    }
}
async function sendChatAction(chatId, action) {
    try {
        await fetch(`${TELEGRAM_API}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action }),
        });
    }
    catch (error) {
        console.error('[Telegram] Chat action error:', error);
    }
}
async function answerCallbackQuery(callbackQueryId, text) {
    try {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
        });
    }
    catch (error) {
        console.error('[Telegram] Answer callback error:', error);
    }
}
// ================================
// Account Linking
// ================================
async function getLinkedFirebaseUid(telegramUserId) {
    try {
        const doc = await db.collection('telegram_links').doc(telegramUserId.toString()).get();
        if (doc.exists) {
            return doc.data()?.firebaseUid || null;
        }
        return null;
    }
    catch (error) {
        console.error('[Telegram] Get linked UID error:', error);
        return null;
    }
}
//# sourceMappingURL=telegram-webhook.handler.js.map