/**
 * Alert Engine Service
 * 
 * Sends notifications based on fused events and notification settings.
 * Supports: Telegram, LINE, Webhook, Email, Slack
 */

import * as admin from 'firebase-admin';
import { NotificationSetting, NotificationConfig , FusedEvent } from '../types/social.types';

import { logAudit } from './audit.service';
import { incrementMetric } from './metrics.service';

const db = admin.firestore();

/**
 * Process and send alerts for a fused event
 */
export async function sendAlertsForEvent(event: FusedEvent): Promise<{
    sent: number;
    failed: number;
    channels: string[];
}> {
    console.log(`[Alert Engine] Processing event: ${event.id}`);
    const result = { sent: 0, failed: 0, channels: [] as string[] };

    try {
        // Get all matching notification settings
        const settings = await getMatchingNotifications(event);
        console.log(`[Alert Engine] Found ${settings.length} matching notification settings`);

        for (const setting of settings) {
            try {
                await sendNotification(setting, event);
                result.sent++;
                result.channels.push(setting.channel);

                // Log success
                await logAudit({
                    tenantId: event.tenantId,
                    type: 'notification_sent',
                    action: 'alert_sent',
                    details: {
                        channel: setting.channel,
                        eventId: event.id,
                        severity: event.severity,
                    },
                });

            } catch (err: any) {
                console.error(`[Alert Engine] Failed to send via ${setting.channel}:`, err);
                result.failed++;
            }
        }

        // Update metrics
        await incrementMetric(event.tenantId, 'alerts_sent', result.sent);
        await incrementMetric(event.tenantId, 'alerts_failed', result.failed);

        // Create alert fused event
        if (result.sent > 0) {
            await createAlertFusedEvent(event, result.channels);
        }

        return result;

    } catch (err: any) {
        console.error('[Alert Engine] Fatal error:', err);
        return result;
    }
}

/**
 * Get notification settings that match the event criteria
 */
async function getMatchingNotifications(event: FusedEvent): Promise<NotificationSetting[]> {
    const snapshot = await db.collection('social_notifications')
        .where('enabled', '==', true)
        .get();

    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as NotificationSetting)
        .filter(setting => {
            return event.severity >= setting.minSeverity;
        });
}

/**
 * Send notification via appropriate channel
 */
async function sendNotification(setting: NotificationSetting, event: FusedEvent): Promise<void> {
    const message = formatMessage(event);

    switch (setting.channel) {
        case 'telegram':
            await sendTelegram(setting.config, message);
            break;
        case 'line':
            await sendLINE(setting.config, message);
            break;
        case 'webhook':
            await sendWebhook(setting.config, event);
            break;
        case 'slack':
            await sendSlack(setting.config, message);
            break;
        case 'email':
            // Email implementation would require SMTP or SendGrid
            console.log('[Alert Engine] Email not implemented yet');
            break;
        default:
            throw new Error(`Unknown channel: ${setting.channel}`);
    }
}

/**
 * Format message for notification
 */
function formatMessage(event: FusedEvent): string {
    const severity = event.severity >= 80 ? '🔴' : event.severity >= 60 ? '🟠' : '🟡';
    const direction = event.direction === 'positive' ? '📈' : event.direction === 'negative' ? '📉' : '➡️';

    return `${severity} [${event.domain.toUpperCase()}] ${event.title}

嚴重度: ${event.severity}/100 ${direction}
類型: ${event.eventType}
${event.location ? `地點: ${event.location}` : ''}
${event.keywords.length > 0 ? `關鍵字: ${event.keywords.join(', ')}` : ''}
${event.impactHint ? `\n影響: ${event.impactHint}` : ''}
${event.rationale ? `\n分析: ${event.rationale}` : ''}

時間: ${new Date(event.ts).toLocaleString('zh-TW')}
${event.url ? `\n詳情: ${event.url}` : ''}`;
}

/**
 * Send via Telegram
 */
async function sendTelegram(config: NotificationConfig, message: string): Promise<void> {
    if (!config.botToken || !config.chatId) {
        throw new Error('Telegram config missing botToken or chatId');
    }

    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: config.chatId,
            text: message,
            parse_mode: 'HTML',
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Telegram API error: ${error}`);
    }
}

/**
 * Send via LINE Notify
 */
async function sendLINE(config: NotificationConfig, message: string): Promise<void> {
    if (!config.accessToken) {
        throw new Error('LINE config missing accessToken');
    }

    const response = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ message }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`LINE Notify API error: ${error}`);
    }
}

/**
 * Send via Webhook
 */
async function sendWebhook(config: NotificationConfig, event: FusedEvent): Promise<void> {
    if (!config.url) {
        throw new Error('Webhook config missing url');
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
    };

    const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
    });

    if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
    }
}

/**
 * Send via Slack
 */
async function sendSlack(config: NotificationConfig, message: string): Promise<void> {
    if (!config.webhookUrl) {
        throw new Error('Slack config missing webhookUrl');
    }

    const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            channel: config.channel,
            text: message,
        }),
    });

    if (!response.ok) {
        throw new Error(`Slack webhook error: ${response.status}`);
    }
}

/**
 * Create alert fused event to track sent notifications
 */
async function createAlertFusedEvent(sourceEvent: FusedEvent, channels: string[]): Promise<void> {
    await db.collection('fused_events').add({
        ts: admin.firestore.FieldValue.serverTimestamp(),
        tenantId: sourceEvent.tenantId,
        domain: 'alert',
        eventType: 'alert.notification.sent',
        title: `通知已發送: ${sourceEvent.title}`,
        severity: sourceEvent.severity,
        direction: sourceEvent.direction,
        sentiment: sourceEvent.sentiment,
        keywords: ['notification', ...channels],
        entities: [],
        rawRef: { sourceEventId: sourceEvent.id, channels },
    });
}
