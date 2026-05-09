"use strict";
/**
 * Telegram Friendly Error Messages
 *
 * Centralized, user-facing error messages organized by domain.
 * Each error includes a recovery hint so the user knows what to do next.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFriendlyError = getFriendlyError;
const DOMAIN_ERRORS = {
    health: {
        text: '😅 健康數據暫時讀不到，可能是帳號尚未綁定。\n\n💡 試試 /link 重新綁定',
        keyboard: [
            [{ text: '🔗 綁定帳號', callback_data: 'cmd_link' }],
            [{ text: '📋 主選單', callback_data: 'cmd_menu' }],
        ],
    },
    finance: {
        text: '💳 帳務系統忙碌中，稍後會恢復。\n\n💡 可以先用 /expense 手動記帳',
        keyboard: [
            [{ text: '💰 快速記帳', callback_data: 'cmd_expense' }],
            [{ text: '📋 主選單', callback_data: 'cmd_menu' }],
        ],
    },
    vehicle: {
        text: '🚗 車輛模組暫時無法連線，請稍後再試。',
        keyboard: [[{ text: '📋 主選單', callback_data: 'cmd_menu' }]],
    },
    invest: {
        text: '📈 市場數據源暫時無法取得，請稍後再試。',
        keyboard: [
            [{ text: '📈 重試', callback_data: 'cmd_invest' }],
            [{ text: '📋 主選單', callback_data: 'cmd_menu' }],
        ],
    },
    loan: {
        text: '🏦 貸款模組暫時無法載入。',
        keyboard: [[{ text: '📋 主選單', callback_data: 'cmd_menu' }]],
    },
    tax: {
        text: '📋 稅務計算模組暫時無法處理，請稍後再試。',
        keyboard: [[{ text: '📋 主選單', callback_data: 'cmd_menu' }]],
    },
    ai: {
        text: '🤖 AI 助理目前忙碌中，請稍後再試一次。\n\n💡 你也可以使用指令模式：/help 查看所有指令',
        keyboard: [
            [{ text: '📖 查看指令', callback_data: 'cmd_help' }],
            [{ text: '📋 主選單', callback_data: 'cmd_menu' }],
        ],
    },
    link: {
        text: '🔗 帳號綁定功能暫時無法使用，請稍後再試。',
        keyboard: [[{ text: '📋 主選單', callback_data: 'cmd_menu' }]],
    },
    default: {
        text: '⚡ 系統忙碌中，請稍後再試。',
        keyboard: [
            [{ text: '📖 查看指令', callback_data: 'cmd_help' }],
            [{ text: '📋 主選單', callback_data: 'cmd_menu' }],
        ],
    },
};
/**
 * 取得友善的錯誤訊息，依據功能領域提供對應的恢復建議和按鈕。
 */
function getFriendlyError(domain) {
    return DOMAIN_ERRORS[domain] || DOMAIN_ERRORS['default'];
}
//# sourceMappingURL=error-messages.js.map