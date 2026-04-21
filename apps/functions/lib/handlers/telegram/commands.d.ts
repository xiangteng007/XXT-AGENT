/**
 * Telegram Command Implementations (V3 Audit #1)
 *
 * Extracted from telegram-webhook.handler.ts
 * Contains all /command handlers and menu builders.
 */
export declare function handleCommand(chatId: number, telegramUserId: number, text: string): Promise<void>;
export declare function sendWelcomeMessage(chatId: number): Promise<void>;
export declare function sendHelpMessage(chatId: number): Promise<void>;
export declare function sendStockPrice(chatId: number, text: string): Promise<void>;
export declare function sendMonthlyReport(chatId: number, telegramUserId: number): Promise<void>;
export declare function sendMainMenu(chatId: number): Promise<void>;
export declare function sendExpenseMenu(chatId: number): Promise<void>;
export declare function sendTodaySchedule(chatId: number, telegramUserId: number): Promise<void>;
export declare function sendSettingsMenu(chatId: number): Promise<void>;
export declare function sendLinkInstructions(chatId: number, telegramUserId: number): Promise<void>;
export declare function sendHealthSnapshot(chatId: number, telegramUserId: number): Promise<void>;
export declare function sendVehicleStatus(chatId: number, telegramUserId: number): Promise<void>;
export declare function sendBalanceInfo(chatId: number, telegramUserId: number): Promise<void>;
export declare function sendInvestmentSummary(chatId: number, telegramUserId: number): Promise<void>;
export declare function sendLoanSummary(chatId: number, telegramUserId: number): Promise<void>;
export declare function sendTaxEstimation(chatId: number, telegramUserId: number): Promise<void>;
export declare function sendFinancialAdvice(chatId: number, telegramUserId: number): Promise<void>;
export declare function sendAgentsDirectory(chatId: number): Promise<void>;
//# sourceMappingURL=commands.d.ts.map