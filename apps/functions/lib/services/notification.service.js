"use strict";
/**
 * Butler Notification Service
 *
 * Handles push notifications for the Personal Butler System via:
 * - LINE Messaging API
 * - Telegram Bot API
 * - Firebase Cloud Messaging (FCM)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationTemplates = exports.NotificationService = void 0;
exports.sendLineNotification = sendLineNotification;
exports.sendLineFlexMessage = sendLineFlexMessage;
exports.sendTelegramNotification = sendTelegramNotification;
exports.sendFcmNotification = sendFcmNotification;
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// ================================
// LINE Messaging Service
// ================================
const LINE_API_BASE = 'https://api.line.me/v2/bot';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
async function sendLineNotification(lineUserId, message, title) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.error('LINE_CHANNEL_ACCESS_TOKEN not configured');
        return false;
    }
    const messageBody = title ? `📢 ${title}\n\n${message}` : message;
    try {
        const response = await fetch(`${LINE_API_BASE}/message/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to: lineUserId,
                messages: [
                    {
                        type: 'text',
                        text: messageBody,
                    },
                ],
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            console.error('LINE push failed:', error);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('LINE push error:', error);
        return false;
    }
}
async function sendLineFlexMessage(lineUserId, flexContent) {
    if (!LINE_CHANNEL_ACCESS_TOKEN)
        return false;
    try {
        const response = await fetch(`${LINE_API_BASE}/message/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to: lineUserId,
                messages: [
                    {
                        type: 'flex',
                        altText: 'Butler Notification',
                        contents: flexContent,
                    },
                ],
            }),
        });
        return response.ok;
    }
    catch {
        return false;
    }
}
// ================================
// Telegram Bot Service
// ================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
async function sendTelegramNotification(chatId, message, title) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN not configured');
        return false;
    }
    const messageText = title ? `📢 *${title}*\n\n${message}` : message;
    try {
        const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: messageText,
                parse_mode: 'Markdown',
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            console.error('Telegram send failed:', error);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('Telegram send error:', error);
        return false;
    }
}
// ================================
// FCM (Firebase Cloud Messaging)
// ================================
async function sendFcmNotification(fcmTokens, title, body, data) {
    if (fcmTokens.length === 0) {
        return { success: 0, failure: 0 };
    }
    try {
        const message = {
            tokens: fcmTokens,
            notification: {
                title,
                body,
            },
            data,
            android: {
                priority: 'high',
                notification: {
                    channelId: 'butler_notifications',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                    },
                },
            },
        };
        const response = await admin.messaging().sendEachForMulticast(message);
        return {
            success: response.successCount,
            failure: response.failureCount,
        };
    }
    catch (error) {
        console.error('FCM send error:', error);
        return { success: 0, failure: fcmTokens.length };
    }
}
// ================================
// Unified Notification Service
// ================================
class NotificationService {
    /**
     * Get user's notification settings
     */
    async getUserSettings(uid) {
        const doc = await db.doc(`users/${uid}/butler/notifications`).get();
        if (!doc.exists)
            return null;
        return doc.data();
    }
    /**
     * Update user's notification settings
     */
    async updateSettings(uid, settings) {
        await db.doc(`users/${uid}/butler/notifications`).set(settings, { merge: true });
    }
    /**
     * Send notification through preferred channels
     */
    async send(payload) {
        const settings = await this.getUserSettings(payload.userId);
        const result = {
            sent: false,
            channels: {},
        };
        if (!settings) {
            console.warn(`No notification settings for user ${payload.userId}`);
            return result;
        }
        // Check Do Not Disturb
        if (this.isDoNotDisturbActive(settings)) {
            result.skipped = 'do_not_disturb';
            return result;
        }
        // Determine channels to use
        const channels = payload.category
            ? settings.preferences[payload.category] || [payload.channel]
            : [payload.channel];
        // Send to each channel
        for (const channel of channels) {
            switch (channel) {
                case 'line':
                    if (settings.lineUserId) {
                        result.channels.line = await sendLineNotification(settings.lineUserId, payload.message, payload.title);
                    }
                    break;
                case 'telegram':
                    if (settings.telegramChatId) {
                        result.channels.telegram = await sendTelegramNotification(settings.telegramChatId, payload.message, payload.title);
                    }
                    break;
                case 'fcm':
                    if (settings.fcmTokens && settings.fcmTokens.length > 0) {
                        const fcmResult = await sendFcmNotification(settings.fcmTokens, payload.title, payload.message, payload.data);
                        result.channels.fcm = fcmResult.success > 0;
                    }
                    break;
            }
        }
        result.sent = Object.values(result.channels).some(v => v);
        // Log notification
        await this.logNotification(payload, result);
        return result;
    }
    /**
     * Send immediate alert (bypasses DND for high priority)
     */
    async sendAlert(userId, title, message, category = 'alert') {
        return this.send({
            userId,
            channel: 'line', // Default to LINE for alerts
            title,
            message,
            category,
            priority: 'high',
        });
    }
    /**
     * Check if Do Not Disturb is active
     */
    isDoNotDisturbActive(settings) {
        if (!settings.doNotDisturb?.enabled)
            return false;
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const [startH, startM] = settings.doNotDisturb.start.split(':').map(Number);
        const [endH, endM] = settings.doNotDisturb.end.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        if (startMinutes <= endMinutes) {
            return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        }
        else {
            // Overnight DND (e.g., 22:00 - 07:00)
            return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }
    }
    /**
     * Log notification for audit
     */
    async logNotification(payload, result) {
        await db.collection(`users/${payload.userId}/butler/notifications/logs`).add({
            ...payload,
            result,
            timestamp: admin.firestore.Timestamp.now(),
        });
    }
}
exports.NotificationService = NotificationService;
// ================================
// Pre-built Notification Templates
// ================================
exports.NotificationTemplates = {
    // Health
    exerciseReminder: (name) => ({
        title: '運動提醒 🏃',
        message: `${name}，該運動了！今天的目標：30分鐘快走`,
    }),
    weightLogged: (weight, change) => ({
        title: '體重記錄 ⚖️',
        message: `已記錄今日體重：${weight} kg${change !== 0 ? ` (${change > 0 ? '+' : ''}${change.toFixed(1)} kg)` : ''}`,
    }),
    // Finance
    billReminder: (name, daysUntil, amount) => ({
        title: '帳單提醒 💳',
        message: `${name} 將於 ${daysUntil} 天後到期${amount ? `，金額：NT$${amount.toLocaleString()}` : ''}`,
    }),
    transactionAlert: (type, amount, category) => ({
        title: type === 'expense' ? '支出記錄 📉' : '收入記錄 📈',
        message: `${category}：NT$${amount.toLocaleString()}`,
    }),
    // Vehicle
    maintenanceReminder: (type, details) => ({
        title: '愛車保養提醒 🚗',
        message: `${type}：${details}`,
    }),
    fuelLogged: (liters, cost, kmPerL) => ({
        title: '加油記錄 ⛽',
        message: `已加 ${liters}L，費用 NT$${cost}，平均油耗 ${kmPerL} km/L`,
    }),
    // Schedule
    eventReminder: (title, time, minutesBefore) => ({
        title: '活動提醒 📅',
        message: `${title} 將於 ${minutesBefore} 分鐘後開始 (${time})`,
    }),
    // Business
    projectUpdate: (projectName, status) => ({
        title: '專案更新 🏢',
        message: `${projectName}：${status}`,
    }),
    paymentReceived: (projectName, amount) => ({
        title: '收款通知 💰',
        message: `${projectName} 已收款 NT$${amount.toLocaleString()}`,
    }),
};
exports.notificationService = new NotificationService();
//# sourceMappingURL=notification.service.js.map