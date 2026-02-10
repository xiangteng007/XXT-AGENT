/**
 * Telegram Types (#6)
 * Shared type definitions for Telegram Bot API
 */

export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    callback_query?: CallbackQuery;
}

export interface TelegramMessage {
    message_id: number;
    from: TelegramUser;
    chat: TelegramChat;
    date: number;
    text?: string;
    voice?: { file_id: string; duration: number };
    location?: { latitude: number; longitude: number };
    photo?: { file_id: string; width: number; height: number; file_size?: number }[];
    caption?: string;
}

export interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

export interface TelegramChat {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
}

export interface CallbackQuery {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
}

export interface InlineKeyboardButton {
    text: string;
    callback_data?: string;
    url?: string;
}
