"use strict";
/**
 * Telegram API Helpers (#6)
 * Low-level Telegram Bot API interaction functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBotToken = getBotToken;
exports.sendMessage = sendMessage;
exports.sendChatAction = sendChatAction;
exports.answerCallbackQuery = answerCallbackQuery;
exports.getLinkedFirebaseUid = getLinkedFirebaseUid;
const v2_1 = require("firebase-functions/v2");
const secrets_1 = require("../../config/secrets");
const firestore_1 = require("firebase-admin/firestore");
// Lazy-loaded Bot Token
let cachedBotToken = null;
async function getBotToken() {
    if (cachedBotToken)
        return cachedBotToken;
    if (process.env.TELEGRAM_BOT_TOKEN) {
        cachedBotToken = process.env.TELEGRAM_BOT_TOKEN;
        return cachedBotToken;
    }
    try {
        cachedBotToken = await (0, secrets_1.getSecret)('TELEGRAM_BOT_TOKEN');
        v2_1.logger.info('[Telegram] Bot token loaded from Secret Manager');
        return cachedBotToken;
    }
    catch (error) {
        v2_1.logger.error('[Telegram] Failed to load bot token:', error);
        throw new Error('TELEGRAM_BOT_TOKEN not available');
    }
}
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
            v2_1.logger.error('[Telegram] Send message failed:', error);
        }
    }
    catch (error) {
        v2_1.logger.error('[Telegram] Send message error:', error);
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
        v2_1.logger.error('[Telegram] Chat action error:', error);
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
        v2_1.logger.error('[Telegram] Answer callback error:', error);
    }
}
async function getLinkedFirebaseUid(telegramUserId) {
    try {
        const db = (0, firestore_1.getFirestore)();
        const doc = await db.collection('telegram_links').doc(telegramUserId.toString()).get();
        if (doc.exists) {
            return doc.data()?.firebaseUid || null;
        }
        return null;
    }
    catch (error) {
        v2_1.logger.error('[Telegram] Get linked UID error:', error);
        return null;
    }
}
//# sourceMappingURL=api.js.map