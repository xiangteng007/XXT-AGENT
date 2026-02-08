/**
 * Butler LINE Webhook Handler
 * 
 * Handles incoming LINE webhook events for the 小秘書 (Personal Butler) bot.
 * Responds to user messages with Butler AI capabilities.
 * Supports Flex Message cards for finance, health, vehicle, and schedule domains.
 */

import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { generateAIResponse } from '../services/butler-ai.service';
import {
    detectDomain,
    buildFinanceSummaryCard,
    buildHealthSummaryCard,
    buildVehicleStatusCard,
    buildScheduleCard,
    buildQuickReplyButtons,
    FlexMessage,
} from '../services/butler-flex.service';

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
// Types
// ================================

interface LineWebhookBody {
    destination: string;
    events: LineEvent[];
}

interface LineEvent {
    type: string;
    timestamp: number;
    source: {
        type: 'user' | 'group' | 'room';
        userId?: string;
        groupId?: string;
        roomId?: string;
    };
    replyToken?: string;
    message?: {
        id: string;
        type: string;
        text?: string;
    };
    postback?: {
        data: string;
    };
}

// ================================
// Main Handler
// ================================

export async function handleButlerWebhook(req: Request, res: Response): Promise<void> {
    console.log('[Butler Webhook] Received request');

    // Verify LINE signature
    const signature = req.headers['x-line-signature'] as string;
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
    const body: LineWebhookBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    console.log('[Butler Webhook] Events:', body.events?.length || 0);

    // Process events
    if (body.events && body.events.length > 0) {
        for (const event of body.events) {
            try {
                await processButlerEvent(event);
            } catch (error) {
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

async function processButlerEvent(event: LineEvent): Promise<void> {
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

async function handleMessageEvent(event: LineEvent): Promise<void> {
    if (!event.replyToken || !event.message) {
        return;
    }

    const userId = event.source.userId;
    const messageText = event.message.text || '';

    console.log(`[Butler] Message from ${userId}: ${messageText}`);

    // Detect domain for Flex Message reply
    const domain = detectDomain(messageText);
    console.log(`[Butler] Detected domain: ${domain}`);

    // Try Flex Message for specific domains
    const flexCard = await buildFlexReply(domain, messageText, userId);
    if (flexCard) {
        await replyMessage(event.replyToken, [flexCard]);
        return;
    }

    // Fallback to AI text response for general queries
    const response = await generateAIResponse(messageText, userId);
    await replyMessage(event.replyToken, [
        { type: 'text', text: response, quickReply: buildQuickReplyButtons() },
    ]);
}

async function handlePostbackEvent(event: LineEvent): Promise<void> {
    if (!event.replyToken || !event.postback) {
        return;
    }

    const userId = event.source.userId;
    const postbackData = event.postback.data;

    console.log(`[Butler] Postback from ${userId}: ${postbackData}`);

    // Use AI response for postback data
    const response = await generateAIResponse(postbackData, userId);

    await replyMessage(event.replyToken, [{
        type: 'text',
        text: response,
    }]);
}

async function handleFollowEvent(event: LineEvent): Promise<void> {
    if (!event.replyToken) return;

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
// Flex Message Reply Builder
// ================================

async function buildFlexReply(
    domain: string,
    _messageText: string,
    _userId?: string
): Promise<FlexMessage | null> {
    try {
        switch (domain) {
            case 'finance':
                // TODO: fetch real data from Firestore
                return buildFinanceSummaryCard({
                    monthLabel: new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' }),
                    totalExpense: 0,
                    totalIncome: 0,
                    topCategories: [],
                    trend: 'flat',
                });
            case 'health':
                return buildHealthSummaryCard({
                    date: new Date().toLocaleDateString('zh-TW'),
                    steps: 0,
                    stepsGoal: 8000,
                    activeMinutes: 0,
                    calories: 0,
                    sleepHours: 0,
                });
            case 'vehicle':
                return buildVehicleStatusCard({
                    make: 'Suzuki',
                    model: 'Jimny',
                    variant: 'JB74',
                    licensePlate: '---',
                    mileage: 0,
                    nextServiceMileage: 5000,
                    insuranceExpiry: '---',
                    inspectionExpiry: '---',
                });
            case 'schedule':
                return buildScheduleCard({
                    date: new Date().toLocaleDateString('zh-TW', { weekday: 'long', month: 'long', day: 'numeric' }),
                    events: [],
                });
            default:
                return null;
        }
    } catch (err) {
        console.error(`[Butler] Flex build failed for ${domain}:`, err);
        return null;
    }
}

// ================================
// LINE API Helpers
// ================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function replyMessage(replyToken: string, messages: Array<Record<string, any>>): Promise<void> {
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
        } else {
            console.log('[Butler] Reply sent successfully');
        }
    } catch (error) {
        console.error('[Butler] Reply error:', error);
    }
}
