/**
 * Telegram API Helpers (V4 — Enhanced)
 *
 * Low-level Telegram Bot API interaction functions.
 * V4 changes:
 *   - parse_mode → HTML (stable, no escaping issues)
 *   - sendLongMessage: auto-chunking for 4096 char limit
 *   - startTypingLoop: continuous typing feedback during AI inference
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

// ── Core Send ────────────────────────────────────────────

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
                text: markdownToHtml(text),
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...options,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            // HTML parse 失敗時 fallback 為純文字重發
            if (error.includes("can't parse entities")) {
                logger.warn('[Telegram] HTML parse failed, resending as plain text');
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: stripHtmlTags(text),
                        ...options,
                    }),
                });
                return;
            }
            logger.error('[Telegram] Send message failed:', error);
        }
    } catch (error) {
        logger.error('[Telegram] Send message error:', error);
    }
}

/**
 * Send a message and return its message_id (needed for editMessage).
 */
export async function sendMessageReturningId(
    chatId: number,
    text: string,
): Promise<number | null> {
    try {
        const token = await getBotToken();
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                disable_web_page_preview: true,
            }),
        });
        if (!response.ok) return null;
        const data = await response.json() as { result?: { message_id?: number } };
        return data.result?.message_id ?? null;
    } catch {
        return null;
    }
}

/**
 * Edit an existing message (used for progressive streaming updates).
 * Telegram rate limit: ~30 edits/second per chat. We throttle in caller.
 */
export async function editMessage(
    chatId: number,
    messageId: number,
    text: string,
    options?: { reply_markup?: { inline_keyboard: InlineKeyboardButton[][] } }
): Promise<boolean> {
    try {
        const token = await getBotToken();
        const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: markdownToHtml(text),
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...options,
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            // "message is not modified" is expected (same content)
            if (errBody.includes('message is not modified')) return true;
            // HTML parse failure — retry as plain text
            if (errBody.includes("can't parse entities")) {
                await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        message_id: messageId,
                        text: stripHtmlTags(text),
                        ...options,
                    }),
                });
                return true;
            }
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

// ── Long Message (auto-chunk) ────────────────────────────

/** Telegram 訊息上限 4096 字元，預留 buffer */
const MAX_MESSAGE_LENGTH = 3800;

/**
 * 發送長訊息，超過 3800 字元時自動在段落邊界分段。
 * 最後一段會附帶 inline keyboard。
 */
export async function sendLongMessage(
    chatId: number,
    text: string,
    options?: { reply_markup?: { inline_keyboard: InlineKeyboardButton[][] } }
): Promise<void> {
    if (text.length <= MAX_MESSAGE_LENGTH) {
        await sendMessage(chatId, text, options);
        return;
    }

    const chunks = splitAtParagraphs(text, MAX_MESSAGE_LENGTH);
    for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        await sendMessage(chatId, chunks[i], isLast ? options : undefined);
        if (!isLast) await delay(300); // 避免 rate limit
    }
}

function splitAtParagraphs(text: string, maxLen: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > maxLen) {
        // 在 maxLen 範圍內找最近的段落換行（雙換行）
        let splitIdx = remaining.lastIndexOf('\n\n', maxLen);
        if (splitIdx < maxLen * 0.3) {
            // 找不到好的分割點，退而求次用單換行
            splitIdx = remaining.lastIndexOf('\n', maxLen);
        }
        if (splitIdx < maxLen * 0.3) {
            // 真的沒有換行，硬切
            splitIdx = maxLen;
        }

        chunks.push(remaining.slice(0, splitIdx).trimEnd());
        remaining = remaining.slice(splitIdx).trimStart();
    }

    if (remaining.length > 0) chunks.push(remaining);
    return chunks;
}

// ── Typing Loop ──────────────────────────────────────────

/**
 * 啟動持續的 typing 動畫。Telegram 的 typing 狀態 5 秒後會消失，
 * 所以每 4 秒重新發送一次。回傳 stop function。
 */
export function startTypingLoop(chatId: number): () => void {
    sendChatAction(chatId, 'typing').catch(() => {/* initial typing */});
    const interval = setInterval(() => {
        sendChatAction(chatId, 'typing').catch(() => {/* silent */});
    }, 4000);

    return () => clearInterval(interval);
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

// ── Helpers ──────────────────────────────────────────────

/**
 * 將 Markdown 格式自動轉換為 Telegram HTML。
 * 這樣現有的 `**bold**` 和 `` `code` `` 模板字串不需要逐一修改。
 */
function markdownToHtml(text: string): string {
    let result = text;
    // **bold** → <b>bold</b>
    result = result.replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>');
    // *italic* → <i>italic</i> (單星號，不含已處理的雙星號)
    result = result.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<i>$1</i>');
    // `code` → <code>code</code> (不處理多行 code block)
    result = result.replace(/(?<!`)(`[^`\n]+?`)(?!`)/g, (_, m) => {
        const inner = m.slice(1, -1);
        return `<code>${inner}</code>`;
    });
    // _italic_ → <i>italic</i> (Telegram Markdown 格式)
    result = result.replace(/(?<![\w/])_([^_\n]+?)_(?!\w)/g, '<i>$1</i>');
    return result;
}

function stripHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, '');
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
