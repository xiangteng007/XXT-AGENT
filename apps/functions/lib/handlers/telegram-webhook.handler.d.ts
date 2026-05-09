/**
 * Telegram Webhook Handler — v4 Enhanced Response
 *
 * V4 enhancements:
 *   - Continuous typing loop during AI inference
 *   - Contextual inline keyboard after AI replies
 *   - Long message auto-chunking
 *   - Friendly error messages
 *
 * @see {@link https://core.telegram.org/bots/api}
 */
import { Request, Response } from 'express';
export declare function handleTelegramWebhook(req: Request, res: Response): Promise<void>;
export declare function handleNaturalLanguage(chatId: number, telegramUserId: number, text: string): Promise<void>;
//# sourceMappingURL=telegram-webhook.handler.d.ts.map