"use strict";
/**
 * Telegram Webhook Handler
 *
 * Handles incoming Telegram Bot API updates for the XXT-AGENT Personal Butler System.
 * Provides the same core functionality as the LINE Bot but with Telegram-specific features.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTelegramWebhook = handleTelegramWebhook;
const butler_ai_service_1 = require("../services/butler-ai.service");
const firestore_1 = require("firebase-admin/firestore");
const secret_manager_1 = require("@google-cloud/secret-manager");
// Lazy-loaded Bot Token from Secret Manager
let cachedBotToken = null;
async function getBotToken() {
    if (cachedBotToken) {
        return cachedBotToken;
    }
    // Try environment variable first (for local dev)
    if (process.env.TELEGRAM_BOT_TOKEN) {
        cachedBotToken = process.env.TELEGRAM_BOT_TOKEN;
        return cachedBotToken;
    }
    // Load from Secret Manager
    try {
        const client = new secret_manager_1.SecretManagerServiceClient();
        const [version] = await client.accessSecretVersion({
            name: 'projects/xxt-agent/secrets/TELEGRAM_BOT_TOKEN/versions/latest',
        });
        cachedBotToken = version.payload?.data?.toString() || '';
        console.log('[Telegram] Bot token loaded from Secret Manager');
        return cachedBotToken;
    }
    catch (error) {
        console.error('[Telegram] Failed to load token from Secret Manager:', error);
        throw new Error('TELEGRAM_BOT_TOKEN not available');
    }
}
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
    console.log(`[Telegram] Message from ${telegramUserId}: ${text || '[non-text content]'}`);
    // Handle voice messages
    if (message.voice) {
        await handleVoiceMessage(chatId, telegramUserId, message);
        return;
    }
    // Handle location sharing
    if (message.location) {
        await handleLocationMessage(chatId, telegramUserId, message.location);
        return;
    }
    // Check if it's a command
    if (text.startsWith('/')) {
        await handleCommand(chatId, telegramUserId, text);
        return;
    }
    // Natural language processing via AI
    await handleNaturalLanguage(chatId, telegramUserId, text);
}
// ================================
// Voice Message Handler (P1)
// ================================
async function handleVoiceMessage(chatId, telegramUserId, message) {
    const voice = message.voice;
    if (!voice)
        return;
    console.log(`[Telegram] Voice message received: duration=${voice.duration}s, file_id=${voice.file_id}`);
    await sendChatAction(chatId, 'typing');
    try {
        // Get bot token for API call
        const token = await getBotToken();
        // Get file path from Telegram
        const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${voice.file_id}`);
        const fileData = await fileResponse.json();
        if (!fileData.ok || !fileData.result?.file_path) {
            await sendMessage(chatId, '❌ 無法處理語音訊息，請稍後再試。');
            return;
        }
        // Download voice file URL
        const voiceUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
        // For now, inform user about the feature status
        // Full Speech-to-Text integration requires Google Cloud Speech API
        await sendMessage(chatId, `🎤 **語音辨識**

已收到您的語音訊息 (${voice.duration} 秒)

⏳ 語音轉文字功能**開發中**

目前請使用文字輸入，例如：
• 「今天花了 150 元吃午餐」
• 「新增下午 3 點開會」
• 「查看本月支出」

💡 *完整語音支援預計下一版本推出*`, {
            reply_markup: {
                inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]],
            },
        });
        // Log for future implementation
        console.log(`[Telegram] Voice file URL: ${voiceUrl} (STT integration pending)`);
    }
    catch (error) {
        console.error('[Telegram] Voice message error:', error);
        await sendMessage(chatId, '❌ 語音處理發生錯誤，請使用文字輸入。');
    }
}
// ================================
// Location Handler (P1)
// ================================
async function handleLocationMessage(chatId, telegramUserId, location) {
    console.log(`[Telegram] Location received: lat=${location.latitude}, lng=${location.longitude}`);
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) {
        await sendMessage(chatId, '❌ 請先綁定帳號才能使用位置功能。\n\n使用 /link 開始綁定。');
        return;
    }
    try {
        // Store location for potential fuel log or vehicle tracking
        await db.collection(`users/${linkedUid}/butler/locations`).add({
            latitude: location.latitude,
            longitude: location.longitude,
            source: 'telegram',
            timestamp: firestore_1.Timestamp.now(),
            type: 'shared', // Could be 'fuel_station', 'parking', etc.
        });
        await sendMessage(chatId, `📍 **位置已記錄**

緯度: ${location.latitude.toFixed(6)}
經度: ${location.longitude.toFixed(6)}

請選擇此位置的用途：`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⛽ 加油站', callback_data: `location_fuel_${location.latitude}_${location.longitude}` }],
                    [{ text: '🅿️ 停車位置', callback_data: `location_parking_${location.latitude}_${location.longitude}` }],
                    [{ text: '🔧 維修廠', callback_data: `location_service_${location.latitude}_${location.longitude}` }],
                    [{ text: '← 返回主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
    catch (error) {
        console.error('[Telegram] Location save error:', error);
        await sendMessage(chatId, '❌ 無法儲存位置，請稍後再試。');
    }
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
async function sendHealthSnapshot(chatId, telegramUserId) {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) {
        await sendMessage(chatId, '❌ 請先綁定帳號才能查看健康數據。\n\n使用 /link 開始綁定。');
        return;
    }
    try {
        // Get user profile for BMI/BMR calculation
        const profileDoc = await db.doc(`users/${linkedUid}/butler/profile`).get();
        const profile = profileDoc.data()?.userProfile || {};
        // Default values if profile incomplete
        const weight = profile.weight || 81.8;
        const height = profile.height || 170;
        const age = profile.age || 40;
        const gender = profile.gender || 'male';
        // Calculate health metrics
        const bmi = Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10;
        const bmr = gender === 'male'
            ? Math.round(88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age))
            : Math.round(447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age));
        // Get BMI category
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
        // Get today's health data
        const today = new Date().toISOString().split('T')[0];
        const todayDoc = await db.doc(`users/${linkedUid}/butler/health/daily/${today}`).get();
        const todayData = todayDoc.data() || {};
        // Get weekly progress
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        const weekSnapshot = await db.collection(`users/${linkedUid}/butler/health/daily`)
            .where('date', '>=', weekStart.toISOString().split('T')[0])
            .get();
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
        await sendMessage(chatId, message, {
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
        console.error('[Telegram] Health snapshot error:', error);
        await sendMessage(chatId, '❌ 無法載入健康數據，請稍後再試。', {
            reply_markup: {
                inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]],
            },
        });
    }
}
async function sendVehicleStatus(chatId, telegramUserId) {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) {
        await sendMessage(chatId, '❌ 請先綁定帳號才能查看車輛狀態。\n\n使用 /link 開始綁定。');
        return;
    }
    try {
        // Get vehicle profile
        const vehicleSnapshot = await db.collection(`users/${linkedUid}/butler/vehicles`).limit(1).get();
        if (vehicleSnapshot.empty) {
            await sendMessage(chatId, '🚗 **車輛管理**\n\n尚未設定車輛資料。\n\n請在 Dashboard 新增您的車輛。', {
                reply_markup: {
                    inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]],
                },
            });
            return;
        }
        const vehicleDoc = vehicleSnapshot.docs[0];
        const vehicle = vehicleDoc.data();
        // Get recent fuel logs
        const fuelSnapshot = await db.collection(`users/${linkedUid}/butler/vehicles/${vehicleDoc.id}/fuelLogs`)
            .orderBy('date', 'desc')
            .limit(5)
            .get();
        // Calculate average fuel consumption
        let avgKmPerLiter = 0;
        let totalCost = 0;
        if (!fuelSnapshot.empty) {
            const fuelLogs = fuelSnapshot.docs.map(d => d.data());
            const totalLiters = fuelLogs.reduce((sum, log) => sum + (log.liters || 0), 0);
            const totalKm = fuelLogs.length > 1
                ? fuelLogs[0].mileage - fuelLogs[fuelLogs.length - 1].mileage
                : 0;
            avgKmPerLiter = totalKm > 0 ? Math.round((totalKm / totalLiters) * 10) / 10 : 0;
            totalCost = fuelLogs.reduce((sum, log) => sum + (log.totalCost || log.liters * log.pricePerLiter || 0), 0);
        }
        // Calculate maintenance countdown
        const maintenanceItems = [];
        const now = new Date();
        if (vehicle.insuranceExpiry) {
            const insuranceDate = new Date(vehicle.insuranceExpiry);
            const daysUntilInsurance = Math.ceil((insuranceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilInsurance <= 30) {
                maintenanceItems.push(`⚠️ 保險到期: ${daysUntilInsurance} 天後`);
            }
        }
        if (vehicle.inspectionExpiry) {
            const inspectionDate = new Date(vehicle.inspectionExpiry);
            const daysUntilInspection = Math.ceil((inspectionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilInspection <= 30) {
                maintenanceItems.push(`⚠️ 驗車到期: ${daysUntilInspection} 天後`);
            }
        }
        // Next oil change estimate (every 5000km or 6 months)
        const lastServiceMileage = vehicle.lastOilChangeMileage || vehicle.currentMileage - 3000;
        const kmUntilOilChange = 5000 - (vehicle.currentMileage - lastServiceMileage);
        if (kmUntilOilChange <= 1000) {
            maintenanceItems.push(`🔧 機油更換: 還剩 ${kmUntilOilChange} km`);
        }
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
    }
    catch (error) {
        console.error('[Telegram] Vehicle status error:', error);
        await sendMessage(chatId, '❌ 無法載入車輛數據，請稍後再試。', {
            reply_markup: {
                inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]],
            },
        });
    }
}
async function sendBalanceInfo(chatId, telegramUserId) {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    if (!linkedUid) {
        await sendMessage(chatId, '❌ 請先綁定帳號才能查看財務資訊。\n\n使用 /link 開始綁定。');
        return;
    }
    try {
        // Get this month's transactions
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = now.toISOString().split('T')[0];
        const transactionSnapshot = await db.collection(`users/${linkedUid}/butler/finance/transactions`)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .get();
        let totalIncome = 0;
        let totalExpenses = 0;
        const categoryTotals = {};
        transactionSnapshot.docs.forEach(doc => {
            const tx = doc.data();
            if (tx.type === 'income') {
                totalIncome += tx.amount || 0;
            }
            else if (tx.type === 'expense') {
                totalExpenses += tx.amount || 0;
                const cat = tx.category || '其他';
                categoryTotals[cat] = (categoryTotals[cat] || 0) + tx.amount;
            }
        });
        const netSavings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
        // Get top 3 expense categories
        const topCategories = Object.entries(categoryTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);
        const topCategoriesText = topCategories.length > 0
            ? topCategories.map(([cat, amt]) => `• ${cat}: $${amt.toLocaleString()}`).join('\n')
            : '• 本月尚無支出記錄';
        const monthName = `${year}年${month}月`;
        // 預設模糊顯示 (隱私保護)
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
    }
    catch (error) {
        console.error('[Telegram] Balance info error:', error);
        await sendMessage(chatId, '❌ 無法載入財務數據，請稍後再試。', {
            reply_markup: {
                inline_keyboard: [[{ text: '← 返回主選單', callback_data: 'cmd_menu' }]],
            },
        });
    }
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
        const token = await getBotToken();
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
        const token = await getBotToken();
        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
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
        const token = await getBotToken();
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
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