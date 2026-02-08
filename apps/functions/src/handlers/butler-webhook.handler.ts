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
import {
    appendMessage,
    getPreviousMessages,
    clearSession,
} from '../services/butler/conversation-session.service';
import { financeService } from '../services/finance.service';
import { healthService } from '../services/health.service';
import { vehicleService } from '../services/vehicle.service';
import { scheduleService } from '../services/schedule.service';
import { parseCommand, executeCommand } from '../services/butler/butler-commands.service';

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

    // Handle special commands
    if (messageText === '清除對話' || messageText === '重新開始') {
        if (userId) await clearSession(userId);
        await replyMessage(event.replyToken, [
            { type: 'text', text: '🔄 對話已重置，有什麼我可以幫您的嗎？', quickReply: buildQuickReplyButtons() },
        ]);
        return;
    }

    // Quick-record commands: 記帳/體重/加油/行程 etc.
    const command = parseCommand(messageText);
    if (command && userId) {
        console.log(`[Butler] Command detected: ${command.action} (${command.confidence})`);
        const result = await executeCommand(userId, command);
        // Save to session for potential undo
        await appendMessage(userId, 'user', messageText);
        await appendMessage(userId, 'assistant', result);
        await replyMessage(event.replyToken, [
            { type: 'text', text: result, quickReply: buildQuickReplyButtons() },
        ]);
        return;
    }

    // Detect domain for Flex Message reply
    const domain = detectDomain(messageText);
    console.log(`[Butler] Detected domain: ${domain}`);

    // Try Flex Message for specific domains
    const flexCard = await buildFlexReply(domain, messageText, userId);
    if (flexCard) {
        await replyMessage(event.replyToken, [flexCard]);
        return;
    }

    // Multi-turn: save user message and get history
    if (userId) {
        await appendMessage(userId, 'user', messageText);
    }

    // Get conversation history for context
    const history = userId ? await getPreviousMessages(userId) : [];
    const contextPrefix = history.length > 1
        ? `以下是之前的對話紀錄：\n${history.slice(0, -1).join('\n')}\n\n用戶最新問題：${messageText}`
        : messageText;

    // AI text response with conversation context
    const response = await generateAIResponse(contextPrefix, userId);

    // Save assistant response to session
    if (userId) {
        await appendMessage(userId, 'assistant', response);
    }

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

    // Parse action from postback data
    const params = new URLSearchParams(postbackData);
    const action = params.get('action');

    switch (action) {
        case 'ai_chat':
            await replyMessage(event.replyToken, [{
                type: 'text',
                text: '🤖 AI 助理已準備好，請直接輸入您的問題！',
                quickReply: buildQuickReplyButtons(),
            }]);
            return;
        case 'clear_session':
            if (userId) await clearSession(userId);
            await replyMessage(event.replyToken, [{
                type: 'text',
                text: '🔄 對話已重置，有什麼我可以幫您的嗎？',
            }]);
            return;
        default:
            break;
    }

    // Default: use AI response for postback data
    const response = await generateAIResponse(postbackData, userId);

    await replyMessage(event.replyToken, [{
        type: 'text',
        text: response,
        quickReply: buildQuickReplyButtons(),
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
    userId?: string
): Promise<FlexMessage | null> {
    try {
        const now = new Date();

        switch (domain) {
            case 'finance': {
                const summary = userId
                    ? await financeService.getMonthlySummary(userId, now.getFullYear(), now.getMonth() + 1)
                    : null;
                const categoryEntries = summary?.expensesByCategory
                    ? Object.entries(summary.expensesByCategory)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 3)
                        .map(([name, amount]) => ({ name, amount: amount as number, emoji: '💳' }))
                    : [];
                return buildFinanceSummaryCard({
                    monthLabel: now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' }),
                    totalExpense: summary?.totalExpenses ?? 0,
                    totalIncome: summary?.totalIncome ?? 0,
                    topCategories: categoryEntries,
                    trend: (summary?.netSavings ?? 0) > 0 ? 'up' : (summary?.netSavings ?? 0) < 0 ? 'down' : 'flat',
                });
            }
            case 'health': {
                const todayHealth = userId
                    ? await healthService.getTodayHealth(userId)
                    : null;
                return buildHealthSummaryCard({
                    date: now.toLocaleDateString('zh-TW'),
                    steps: todayHealth?.steps ?? 0,
                    stepsGoal: 8000,
                    activeMinutes: todayHealth?.activeMinutes ?? 0,
                    calories: todayHealth?.caloriesBurned ?? 0,
                    sleepHours: todayHealth?.sleepHours ?? 0,
                });
            }
            case 'vehicle': {
                // Get first vehicle for the user
                const dashboard = userId
                    ? await vehicleService.getDashboard(userId, 'default').catch(() => null)
                    : null;
                return buildVehicleStatusCard({
                    make: dashboard?.vehicle?.make ?? 'Suzuki',
                    model: dashboard?.vehicle?.model ?? 'Jimny',
                    variant: dashboard?.vehicle?.variant ?? 'JB74',
                    licensePlate: dashboard?.vehicle?.licensePlate ?? '---',
                    mileage: dashboard?.vehicle?.currentMileage ?? 0,
                    nextServiceMileage: dashboard?.urgentReminders?.[0]?.dueMileage ?? 5000,
                    insuranceExpiry: '---',
                    inspectionExpiry: '---',
                });
            }
            case 'schedule': {
                const dailySchedule = userId
                    ? await scheduleService.getTodaySchedule(userId)
                    : null;
                const events = dailySchedule?.events?.map(e => ({
                    time: typeof e.start === 'string'
                        ? e.start
                        : (e.start as Date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                    title: e.title,
                    location: e.location,
                    emoji: e.category === 'work' ? '💼' : e.category === 'health' ? '🏃' : '📌',
                })) ?? [];
                return buildScheduleCard({
                    date: now.toLocaleDateString('zh-TW', { weekday: 'long', month: 'long', day: 'numeric' }),
                    events,
                });
            }
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
