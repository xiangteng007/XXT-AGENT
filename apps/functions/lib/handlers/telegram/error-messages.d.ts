/**
 * Telegram Friendly Error Messages
 *
 * Centralized, user-facing error messages organized by domain.
 * Each error includes a recovery hint so the user knows what to do next.
 */
export interface FriendlyError {
    text: string;
    keyboard?: {
        text: string;
        callback_data: string;
    }[][];
}
/**
 * 取得友善的錯誤訊息，依據功能領域提供對應的恢復建議和按鈕。
 */
export declare function getFriendlyError(domain: string): FriendlyError;
//# sourceMappingURL=error-messages.d.ts.map