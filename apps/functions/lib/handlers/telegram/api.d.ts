/**
 * Telegram API Helpers (V4 — Enhanced)
 *
 * Low-level Telegram Bot API interaction functions.
 * V4 changes:
 *   - parse_mode → HTML (stable, no escaping issues)
 *   - sendLongMessage: auto-chunking for 4096 char limit
 *   - startTypingLoop: continuous typing feedback during AI inference
 */
import type { InlineKeyboardButton } from './types';
export declare function getBotToken(): Promise<string>;
export declare function sendMessage(chatId: number, text: string, options?: {
    reply_markup?: {
        inline_keyboard: InlineKeyboardButton[][];
    };
}): Promise<void>;
/**
 * Send a message and return its message_id (needed for editMessage).
 */
export declare function sendMessageReturningId(chatId: number, text: string): Promise<number | null>;
/**
 * Edit an existing message (used for progressive streaming updates).
 * Telegram rate limit: ~30 edits/second per chat. We throttle in caller.
 */
export declare function editMessage(chatId: number, messageId: number, text: string, options?: {
    reply_markup?: {
        inline_keyboard: InlineKeyboardButton[][];
    };
}): Promise<boolean>;
/**
 * 發送長訊息，超過 3800 字元時自動在段落邊界分段。
 * 最後一段會附帶 inline keyboard。
 */
export declare function sendLongMessage(chatId: number, text: string, options?: {
    reply_markup?: {
        inline_keyboard: InlineKeyboardButton[][];
    };
}): Promise<void>;
/**
 * 啟動持續的 typing 動畫。Telegram 的 typing 狀態 5 秒後會消失，
 * 所以每 4 秒重新發送一次。回傳 stop function。
 */
export declare function startTypingLoop(chatId: number): () => void;
export declare function sendChatAction(chatId: number, action: 'typing' | 'upload_photo'): Promise<void>;
export declare function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
export declare function getLinkedFirebaseUid(telegramUserId: number): Promise<string | null>;
//# sourceMappingURL=api.d.ts.map