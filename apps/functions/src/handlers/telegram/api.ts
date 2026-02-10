/**
 * Telegram API Helpers (#6)
 * Low-level Telegram Bot API interaction functions
 */

import { logger } from 'firebase-functions/v2';
import { getSecret } from '../../config/secrets';
import { getFirestore } from 'firebase-admin/firestore';
import type { InlineKeyboardButton } from './types';

// Lazy-loaded Bot Token
let cachedBotToken: string | null = null;

export async function getBotToken(): Promise<string> {
    if (cachedBotToken) return cachedBotToken;
    
    if (process.env.TELEGRAM_BOT_TOKEN) {
        cachedBotToken = process.env.TELEGRAM_BOT_TOKEN;
        return cachedBotToken;
    }
    
    try {
        cachedBotToken = await getSecret('TELEGRAM_BOT_TOKEN');
        logger.info('[Telegram] Bot token loaded from Secret Manager');
        return cachedBotToken;
    } catch (error) {
        logger.error('[Telegram] Failed to load bot token:', error);
        throw new Error('TELEGRAM_BOT_TOKEN not available');
    }
}

export async function sendMessage(
    chatId: number,
    text: string,
    options?: { reply_markup?: { inline_keyboard: InlineKeyboardButton[][] } }
): Promise<void> {
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
            logger.error('[Telegram] Send message failed:', error);
        }
    } catch (error) {
        logger.error('[Telegram] Send message error:', error);
    }
}

export async function sendChatAction(chatId: number, action: 'typing' | 'upload_photo'): Promise<void> {
    try {
        const token = await getBotToken();
        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action }),
        });
    } catch (error) {
        logger.error('[Telegram] Chat action error:', error);
    }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    try {
        const token = await getBotToken();
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
        });
    } catch (error) {
        logger.error('[Telegram] Answer callback error:', error);
    }
}

export async function getLinkedFirebaseUid(telegramUserId: number): Promise<string | null> {
    try {
        const db = getFirestore();
        const doc = await db.collection('telegram_links').doc(telegramUserId.toString()).get();
        if (doc.exists) {
            return doc.data()?.firebaseUid || null;
        }
        return null;
    } catch (error) {
        logger.error('[Telegram] Get linked UID error:', error);
        return null;
    }
}
