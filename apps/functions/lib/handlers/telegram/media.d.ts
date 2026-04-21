/**
 * Telegram Media Handlers (V3 Audit #1)
 *
 * Extracted from telegram-webhook.handler.ts
 * Contains voice STT, location sharing, and photo/OCR receipt handlers.
 */
import type { TelegramMessage } from './types';
export declare function handleVoiceMessage(chatId: number, telegramUserId: number, message: TelegramMessage, handleNaturalLanguage: (chatId: number, telegramUserId: number, text: string) => Promise<void>): Promise<void>;
export declare function handleLocationMessage(chatId: number, telegramUserId: number, location: {
    latitude: number;
    longitude: number;
}): Promise<void>;
export declare function handlePhotoMessage(chatId: number, telegramUserId: number, message: TelegramMessage): Promise<void>;
//# sourceMappingURL=media.d.ts.map