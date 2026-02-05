"use strict";
/**
 * Alert Engine Service
 *
 * Sends notifications based on fused events and notification settings.
 * Supports: Telegram, LINE, Webhook, Email, Slack
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
exports.sendAlertsForEvent = sendAlertsForEvent;
const admin = __importStar(require("firebase-admin"));
const audit_service_1 = require("./audit.service");
const metrics_service_1 = require("./metrics.service");
const db = admin.firestore();
/**
 * Process and send alerts for a fused event
 */
async function sendAlertsForEvent(event) {
    console.log(`[Alert Engine] Processing event: ${event.id}`);
    const result = { sent: 0, failed: 0, channels: [] };
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
                await (0, audit_service_1.logAudit)({
                    tenantId: event.tenantId,
                    type: 'notification_sent',
                    action: 'alert_sent',
                    details: {
                        channel: setting.channel,
                        eventId: event.id,
                        severity: event.severity,
                    },
                });
            }
            catch (err) {
                console.error(`[Alert Engine] Failed to send via ${setting.channel}:`, err);
                result.failed++;
            }
        }
        // Update metrics
        await (0, metrics_service_1.incrementMetric)(event.tenantId, 'alerts_sent', result.sent);
        await (0, metrics_service_1.incrementMetric)(event.tenantId, 'alerts_failed', result.failed);
        // Create alert fused event
        if (result.sent > 0) {
            await createAlertFusedEvent(event, result.channels);
        }
        return result;
    }
    catch (err) {
        console.error('[Alert Engine] Fatal error:', err);
        return result;
    }
}
/**
 * Get notification settings that match the event criteria
 */
async function getMatchingNotifications(event) {
    const snapshot = await db.collection('social_notifications')
        .where('enabled', '==', true)
        .get();
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(setting => {
        return event.severity >= setting.minSeverity;
    });
}
/**
 * Send notification via appropriate channel
 */
async function sendNotification(setting, event) {
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
function formatMessage(event) {
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
async function sendTelegram(config, message) {
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
async function sendLINE(config, message) {
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
async function sendWebhook(config, event) {
    if (!config.url) {
        throw new Error('Webhook config missing url');
    }
    const headers = {
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
async function sendSlack(config, message) {
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
async function createAlertFusedEvent(sourceEvent, channels) {
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
//# sourceMappingURL=alert-engine.service.js.map