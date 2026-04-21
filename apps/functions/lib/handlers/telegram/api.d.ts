/**
 * Telegram API Helpers (#6)
 * Low-level Telegram Bot API interaction functions
 */
import type { InlineKeyboardButton } from './types';
export declare function getBotToken(): Promise<string>;
export declare function sendMessage(chatId: number, text: string, options?: {
    reply_markup?: {
        inline_keyboard: InlineKeyboardButton[][];
    };
}): Promise<void>;
export declare function sendChatAction(chatId: number, action: 'typing' | 'upload_photo'): Promise<void>;
export declare function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
export declare function getLinkedFirebaseUid(telegramUserId: number): Promise<string | null>;
//# sourceMappingURL=api.d.ts.map