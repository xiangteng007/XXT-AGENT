/**
 * Telegram Module Index (V3 Audit #1)
 * Re-exports all telegram modules for clean imports
 */

// Types
export * from './types';

// API Helpers (low-level Telegram Bot API)
export { sendMessage, sendChatAction, answerCallbackQuery, getLinkedFirebaseUid, getBotToken } from './api';

// Commands (all /command handlers)
export { handleCommand } from './commands';
export { sendWelcomeMessage, sendHelpMessage, sendMainMenu, sendExpenseMenu } from './commands';
export { sendStockPrice, sendMonthlyReport, sendTodaySchedule, sendSettingsMenu } from './commands';
export { sendLinkInstructions, sendHealthSnapshot, sendVehicleStatus, sendBalanceInfo } from './commands';
export { sendInvestmentSummary, sendLoanSummary, sendTaxEstimation, sendFinancialAdvice } from './commands';

// Callbacks & Tools
export { handleCallbackQuery, handleExpenseCategory, executeTelegramToolCalls } from './callbacks';

// Media Handlers
export { handleVoiceMessage, handleLocationMessage, handlePhotoMessage } from './media';
