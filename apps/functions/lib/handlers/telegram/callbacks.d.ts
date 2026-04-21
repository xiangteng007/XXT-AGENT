/**
 * Telegram Callback & Tool Handlers (V3 Audit #1)
 *
 * Extracted from telegram-webhook.handler.ts
 * Contains callback query handling, tool execution, and expense category flow.
 */
import type { CallbackQuery } from './types';
export declare function handleCallbackQuery(query: CallbackQuery): Promise<void>;
export declare function handleExpenseCategory(chatId: number, telegramUserId: number, category: string): Promise<void>;
export declare function executeTelegramToolCalls(userId: string, toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
}>): Promise<string[]>;
//# sourceMappingURL=callbacks.d.ts.map