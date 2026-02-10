/**
 * Telegram API Helpers (#6)
 * Low-level Telegram Bot API interaction functions
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { getFirestore } from 'firebase-admin/firestore';
import type { InlineKeyboardButton } from './types';

// Lazy-loaded Bot Token from Secret Manager
let cachedBotToken: string | null = null;

export async function getBotToken(): Promise<string> {
    if (cachedBotToken) return cachedBotToken;
    
    if (process.env.TELEGRAM_BOT_TOKEN) {
        cachedBotToken = process.env.TELEGRAM_BOT_TOKEN;
        return cachedBotToken;
    }
    
    try {
        const client = new SecretManagerServiceClient();
        const [version] = await client.accessSecretVersion({
            name: 'projects/xxt-agent/secrets/TELEGRAM_BOT_TOKEN/versions/latest',
        });
        cachedBotToken = version.payload?.data?.toString() || '';
        console.log('[Telegram] Bot token loaded from Secret Manager');
        return cachedBotToken;
    } catch (error) {
        console.error('[Telegram] Failed to load token from Secret Manager:', error);
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
            console.error('[Telegram] Send message failed:', error);
        }
    } catch (error) {
        console.error('[Telegram] Send message error:', error);
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
        console.error('[Telegram] Chat action error:', error);
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
        console.error('[Telegram] Answer callback error:', error);
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
        console.error('[Telegram] Get linked UID error:', error);
        return null;
    }
}
