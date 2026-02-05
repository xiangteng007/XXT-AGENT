/**
 * Butler Notification Service
 *
 * Handles push notifications for the Personal Butler System via:
 * - LINE Messaging API
 * - Telegram Bot API
 * - Firebase Cloud Messaging (FCM)
 */
export type NotificationChannel = 'line' | 'telegram' | 'fcm' | 'email';
export interface NotificationPayload {
    userId: string;
    channel: NotificationChannel;
    title: string;
    message: string;
    data?: Record<string, string>;
    category?: 'health' | 'finance' | 'vehicle' | 'schedule' | 'business' | 'alert';
    priority?: 'high' | 'normal' | 'low';
}
export interface UserNotificationSettings {
    lineUserId?: string;
    telegramChatId?: string;
    fcmTokens?: string[];
    preferences: {
        health: NotificationChannel[];
        finance: NotificationChannel[];
        vehicle: NotificationChannel[];
        schedule: NotificationChannel[];
        business: NotificationChannel[];
        alert: NotificationChannel[];
    };
    doNotDisturb?: {
        enabled: boolean;
        start: string;
        end: string;
    };
}
export declare function sendLineNotification(lineUserId: string, message: string, title?: string): Promise<boolean>;
export declare function sendLineFlexMessage(lineUserId: string, flexContent: Record<string, unknown>): Promise<boolean>;
export declare function sendTelegramNotification(chatId: string, message: string, title?: string): Promise<boolean>;
export declare function sendFcmNotification(fcmTokens: string[], title: string, body: string, data?: Record<string, string>): Promise<{
    success: number;
    failure: number;
}>;
export declare class NotificationService {
    /**
     * Get user's notification settings
     */
    getUserSettings(uid: string): Promise<UserNotificationSettings | null>;
    /**
     * Update user's notification settings
     */
    updateSettings(uid: string, settings: Partial<UserNotificationSettings>): Promise<void>;
    /**
     * Send notification through preferred channels
     */
    send(payload: NotificationPayload): Promise<NotificationResult>;
    /**
     * Send immediate alert (bypasses DND for high priority)
     */
    sendAlert(userId: string, title: string, message: string, category?: NotificationPayload['category']): Promise<NotificationResult>;
    /**
     * Check if Do Not Disturb is active
     */
    private isDoNotDisturbActive;
    /**
     * Log notification for audit
     */
    private logNotification;
}
export interface NotificationResult {
    sent: boolean;
    skipped?: string;
    channels: {
        line?: boolean;
        telegram?: boolean;
        fcm?: boolean;
        email?: boolean;
    };
}
export declare const NotificationTemplates: {
    exerciseReminder: (name: string) => {
        title: string;
        message: string;
    };
    weightLogged: (weight: number, change: number) => {
        title: string;
        message: string;
    };
    billReminder: (name: string, daysUntil: number, amount?: number) => {
        title: string;
        message: string;
    };
    transactionAlert: (type: string, amount: number, category: string) => {
        title: string;
        message: string;
    };
    maintenanceReminder: (type: string, details: string) => {
        title: string;
        message: string;
    };
    fuelLogged: (liters: number, cost: number, kmPerL: number) => {
        title: string;
        message: string;
    };
    eventReminder: (title: string, time: string, minutesBefore: number) => {
        title: string;
        message: string;
    };
    projectUpdate: (projectName: string, status: string) => {
        title: string;
        message: string;
    };
    paymentReceived: (projectName: string, amount: number) => {
        title: string;
        message: string;
    };
};
export declare const notificationService: NotificationService;
//# sourceMappingURL=notification.service.d.ts.map