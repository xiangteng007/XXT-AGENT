"use strict";
/**
 * Butler LINE Webhook Handler
 *
 * Handles incoming LINE webhook events for the 小秘書 (Personal Butler) bot.
 * Responds to user messages with Butler AI capabilities.
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
exports.handleButlerWebhook = handleButlerWebhook;
const crypto = __importStar(require("crypto"));
const butler_ai_service_1 = require("../services/butler-ai.service");
// LINE Channel Secret for signature verification
// SECURITY: These MUST be set via environment variables - no fallback values allowed
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
// Validate required environment variables at startup
if (!CHANNEL_SECRET || !CHANNEL_ACCESS_TOKEN) {
    console.error('CRITICAL: LINE_CHANNEL_SECRET and LINE_CHANNEL_ACCESS_TOKEN must be set');
}
// LINE API Base URL
const LINE_API_BASE = 'https://api.line.me/v2/bot';
// ================================
// Main Handler
// ================================
async function handleButlerWebhook(req, res) {
    console.log('[Butler Webhook] Received request');
    // Verify LINE signature
    const signature = req.headers['x-line-signature'];
    if (!signature) {
        console.warn('[Butler Webhook] Missing signature');
        res.status(401).send('Missing signature');
        return;
    }
    // Get raw body for signature verification
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('SHA256', CHANNEL_SECRET || '')
        .update(rawBody)
        .digest('base64');
    if (signature !== expectedSignature) {
        console.warn('[Butler Webhook] Invalid signature');
        res.status(401).send('Invalid signature');
        return;
    }
    // Parse body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    console.log('[Butler Webhook] Events:', body.events?.length || 0);
    // Process events
    if (body.events && body.events.length > 0) {
        for (const event of body.events) {
            try {
                await processButlerEvent(event);
            }
            catch (error) {
                console.error('[Butler Webhook] Error processing event:', error);
            }
        }
    }
    // Fast ACK
    res.status(200).send('OK');
}
// ================================
// Event Processing
// ================================
async function processButlerEvent(event) {
    console.log('[Butler] Processing event:', event.type);
    switch (event.type) {
        case 'message':
            await handleMessageEvent(event);
            break;
        case 'postback':
            await handlePostbackEvent(event);
            break;
        case 'follow':
            await handleFollowEvent(event);
            break;
        case 'unfollow':
            console.log('[Butler] User unfollowed:', event.source.userId);
            break;
        default:
            console.log('[Butler] Unhandled event type:', event.type);
    }
}
// ================================
// Message Handling
// ================================
async function handleMessageEvent(event) {
    if (!event.replyToken || !event.message) {
        return;
    }
    const userId = event.source.userId;
    const messageText = event.message.text || '';
    console.log(`[Butler] Message from ${userId}: ${messageText}`);
    // Generate AI response (with fallback to keyword matching)
    const response = await (0, butler_ai_service_1.generateAIResponse)(messageText, userId);
    // Send reply
    await replyMessage(event.replyToken, [{
            type: 'text',
            text: response,
        }]);
}
async function handlePostbackEvent(event) {
    if (!event.replyToken || !event.postback) {
        return;
    }
    const userId = event.source.userId;
    const postbackData = event.postback.data;
    console.log(`[Butler] Postback from ${userId}: ${postbackData}`);
    // Use AI response for postback data
    const response = await (0, butler_ai_service_1.generateAIResponse)(postbackData, userId);
    await replyMessage(event.replyToken, [{
            type: 'text',
            text: response,
        }]);
}
async function handleFollowEvent(event) {
    if (!event.replyToken)
        return;
    const welcomeMessage = `👋 您好！我是小秘書，您的個人智能管家助理。

我可以幫助您：
📋 管理行程與提醒
💰 追蹤財務支出
🚗 管理愛車資訊
🏃 記錄健康數據
🏢 追蹤工作專案

直接輸入您的需求，我會盡力為您服務！

💡 試試看說：
• "今天行程"
• "這個月支出多少"
• "車輛該保養了嗎"`;
    await replyMessage(event.replyToken, [{
            type: 'text',
            text: welcomeMessage,
        }]);
}
// ================================
// LINE API Helpers
// ================================
async function replyMessage(replyToken, messages) {
    try {
        const response = await fetch(`${LINE_API_BASE}/message/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                replyToken,
                messages,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            console.error('[Butler] Reply failed:', error);
        }
        else {
            console.log('[Butler] Reply sent successfully');
        }
    }
    catch (error) {
        console.error('[Butler] Reply error:', error);
    }
}
//# sourceMappingURL=butler-webhook.handler.js.map