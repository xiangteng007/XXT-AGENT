/**
 * Telegram Webhook Handler — v4 Enhanced Response
 *
 * V4 enhancements:
 *   - Continuous typing loop during AI inference
 *   - Contextual inline keyboard after AI replies
 *   - Long message auto-chunking
 *   - Friendly error messages
 *
 * @see {@link https://core.telegram.org/bots/api}
 */

import { logger } from 'firebase-functions/v2';
import { Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import {
    appendMessage,
    getPreviousMessages,
    getSession,
} from '../services/butler/conversation-session.service';
import { generateStreamingResponse } from '../services/butler-ai.service';
import { retrieveRAGContext } from '../services/rag-context.service';
import { preWarmModel } from '../services/local-inference.service';
import { parseLocalToolCall } from '../services/local-tool-parser.service';

// ---- Modular V3 sub-modules ----
import { handleCommand } from './telegram/commands';
import { handleCallbackQuery, executeTelegramToolCalls } from './telegram/callbacks';
import { sendMessage, sendLongMessage, startTypingLoop, getLinkedFirebaseUid, sendMessageReturningId, editMessage } from './telegram/api';
import type { TelegramUpdate, TelegramMessage, InlineKeyboardButton } from './telegram/types';

// ---- V3 Media handlers (extracted from legacy inline code) ----
import {
    handleVoiceMessage,
    handleLocationMessage,
    handlePhotoMessage,
} from './telegram/media';

const db = getFirestore();

// Lazy pre-warm: trigger once on first request after cold start
let _preWarmed = false;
function triggerPreWarm(): void {
    if (_preWarmed) return;
    _preWarmed = true;
    // Fire-and-forget — don't block the request
    preWarmModel('qwen3:14b').catch(() => {/* silent */});
}

// ================================
// Main Webhook Handler
// ================================

export async function handleTelegramWebhook(req: Request, res: Response): Promise<void> {
    // Immediate 200 — prevents Telegram from retrying
    res.status(200).send('OK');

    // Pre-warm Ollama model on first request (non-blocking)
    triggerPreWarm();

    try {
        const update: TelegramUpdate = req.body;

        // Idempotency: skip already-processed update_ids
        const updateId = String(update.update_id);
        const dedupeRef = db.collection('_telegramDedup').doc(updateId);
        const existing = await dedupeRef.get();
        if (existing.exists) {
            logger.warn('[Telegram] Duplicate update_id skipped:', updateId);
            return;
        }
        await dedupeRef.set({ processedAt: Date.now() });

        if (update.message) {
            await handleMessage(update.message);
        } else if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
        }
    } catch (error) {
        logger.error('[Telegram Webhook] Unhandled error:', error);
    }
}

// ================================
// Message Dispatcher
// ================================

async function handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const telegramUserId = message.from.id;
    const text = message.text || '';

    logger.info(`[Telegram] Incoming from ${telegramUserId}: "${text || '[media]'}"`);
    // Diagnostic: verify UTF-8 encoding of incoming text
    if (text) {
        const hexSample = Buffer.from(text.slice(0, 10), 'utf8').toString('hex');
        logger.info(`[Telegram] Text diagnostics: len=${text.length} hex=${hexSample} json=${JSON.stringify(text.slice(0, 20))}`);
    }
    // Voice STT — delegates to media.ts, passes handleNaturalLanguage as callback
    if (message.voice) {
        await handleVoiceMessage(chatId, telegramUserId, message, handleNaturalLanguage);
        return;
    }

    // Location sharing — delegates to media.ts
    if (message.location) {
        await handleLocationMessage(chatId, telegramUserId, message.location);
        return;
    }

    // Photo/Receipt OCR — delegates to media.ts
    if (message.photo && message.photo.length > 0) {
        await handlePhotoMessage(chatId, telegramUserId, message);
        return;
    }

    // /command routing
    if (text.startsWith('/')) {
        await handleCommand(chatId, telegramUserId, text);
        return;
    }

    // Natural language → AI inference
    await handleNaturalLanguage(chatId, telegramUserId, text);
}

// ================================
// Natural Language → AI Inference (V4 Enhanced)
// ================================

export async function handleNaturalLanguage(
    chatId: number,
    telegramUserId: number,
    text: string
): Promise<void> {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    const userId = linkedUid || `telegram:${telegramUserId}`;

    // V5: typing 動畫
    const stopTyping = startTypingLoop(chatId);

    try {
        await appendMessage(userId, 'user', text);

        // 並行取得：短期對話歷史 + 當前 session + NAS 長期語義記憶 (ChromaDB)
        const [history, session, ragContext] = await Promise.all([
            getPreviousMessages(userId),
            getSession(userId),
            retrieveRAGContext(userId, text),
        ]);

        // 組合 context：短期歷史 + RAG 長期記憶
        const fullHistory = ragContext
            ? [...history, `[RAG Context] ${ragContext}`]
            : history;

        // ── Step 1: Local tool parsing (fast, non-streaming) ──
        const agent = session.activeAgent || 'butler';
        const parseResult = await parseLocalToolCall(text, agent);

        if (parseResult.toolCall !== null) {
            // Tool intent detected — execute tool calls
            stopTyping();
            logger.info(`[Telegram] 🔧 Tool detected: ${parseResult.toolCall.name} via ${parseResult.source}`);
            const toolResults = await executeTelegramToolCalls(
                userId,
                [{ name: parseResult.toolCall.name, args: parseResult.toolCall.args }]
            );
            const combined = toolResults.join('\n\n');
            await appendMessage(userId, 'assistant', combined);
            await sendLongMessage(chatId, combined, {
                reply_markup: {
                    inline_keyboard: buildToolFollowUpKeyboard(
                        [{ name: parseResult.toolCall.name, args: parseResult.toolCall.args }]
                    ),
                },
            });
            return;
        }

        // ── Step 2: Streaming conversation (PRIMARY path) ──
        // No tool intent → stream AI response with progressive Telegram edits
        stopTyping();
        await handleStreamingResponse(chatId, userId, text, fullHistory, agent);

    } catch (error) {
        stopTyping();
        logger.error('[Telegram] Natural language error:', error);
        await sendMessage(chatId, '🤖 AI 助理暫時忙碌中，請稍後再試。\n\n💡 你也可以使用 /help 查看指令模式', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📖 指令列表', callback_data: 'cmd_help' }],
                    [{ text: '📋 主選單', callback_data: 'cmd_menu' }],
                ],
            },
        });
    }
}

// ================================
// V5: Streaming Response Handler
// ================================

/** Minimum chars between Telegram message edits (avoid rate limiting) */
const STREAM_UPDATE_INTERVAL_CHARS = 40;
/** Minimum ms between edits */
const STREAM_UPDATE_INTERVAL_MS = 800;

/**
 * Stream Ollama response and progressively update a Telegram message.
 * Sends "⏳ 思考中..." first, then edits it as tokens arrive.
 */
async function handleStreamingResponse(
    chatId: number,
    userId: string,
    text: string,
    history: string[],
    activeAgent?: string
): Promise<void> {
    // Send placeholder message
    const messageId = await sendMessageReturningId(chatId, '⏳ 思考中...');
    if (!messageId) {
        // Fallback: can't get message ID — use non-streaming
        const { generateAIResponse } = await import('../services/butler-ai.service');
        const aiText = await generateAIResponse(text, userId, {
            previousMessages: history,
            activeAgent,
        });
        await appendMessage(userId, 'assistant', aiText);
        await sendLongMessage(chatId, aiText);
        return;
    }

    let lastUpdateLen = 0;
    let lastUpdateMs = Date.now();
    let finalText = '';
    let finalBackend = '';
    let finalModel = '';

    try {
        for await (const chunk of generateStreamingResponse(text, userId, {
            previousMessages: history,
            activeAgent,
        })) {
            finalText = chunk.text;
            finalBackend = chunk.backend;
            finalModel = chunk.model;

            const now = Date.now();
            const shouldUpdate = (
                chunk.done ||
                (chunk.text.length - lastUpdateLen >= STREAM_UPDATE_INTERVAL_CHARS &&
                 now - lastUpdateMs >= STREAM_UPDATE_INTERVAL_MS)
            );

            if (shouldUpdate) {
                const displayText = chunk.done
                    ? chunk.text
                    : chunk.text + ' ▍';  // cursor indicator

                await editMessage(chatId, messageId, displayText);
                lastUpdateLen = chunk.text.length;
                lastUpdateMs = now;
            }
        }

        // Final edit with inline keyboard
        const suggestedButtons = inferNextActions(text, finalText, activeAgent);
        await editMessage(chatId, messageId, finalText, {
            reply_markup: { inline_keyboard: suggestedButtons },
        });

        await appendMessage(userId, 'assistant', finalText);

        logger.info(`[Telegram] ✅ Streaming response via ${finalBackend}/${finalModel} len=${finalText.length}`);
    } catch (err) {
        logger.error('[Telegram] Streaming handler error:', err);
        // Edit the placeholder with error message
        await editMessage(chatId, messageId, '🤖 AI 推理中發生錯誤，請重試。');
    }
}

// ================================
// V4: Contextual Action Inference
// ================================

/**
 * 根據用戶輸入和 AI 回覆內容，智慧推薦後續操作按鈕。
 */
function inferNextActions(
    userText: string,
    aiReply: string,
    activeAgent?: string,
): InlineKeyboardButton[][] {
    const combined = (userText + ' ' + aiReply).toLowerCase();
    const buttons: InlineKeyboardButton[][] = [];

    // 投資/股票相關
    if (/投資|股票|etf|持倉|0050|2330|portfolio/i.test(combined)) {
        buttons.push([
            { text: '📈 投資組合', callback_data: 'cmd_invest' },
            { text: '📡 交易訊號', callback_data: 'cmd_signal' },
        ]);
    }

    // 記帳/支出相關
    if (/花費|支出|記帳|消費|買了|expense/i.test(combined)) {
        buttons.push([
            { text: '💰 快速記帳', callback_data: 'cmd_expense' },
            { text: '💳 財務概況', callback_data: 'cmd_balance' },
        ]);
    }

    // 行程相關
    if (/行程|開會|約會|提醒|schedule|meeting/i.test(combined)) {
        buttons.push([
            { text: '📋 今日行程', callback_data: 'cmd_today' },
            { text: '➕ 新增事件', callback_data: 'add_event' },
        ]);
    }

    // 健康相關
    if (/健康|運動|體重|步數|bmi|health/i.test(combined)) {
        buttons.push([
            { text: '🏃 健康快照', callback_data: 'cmd_health' },
        ]);
    }

    // 車輛相關
    if (/車|加油|保養|jimny|vehicle/i.test(combined)) {
        buttons.push([
            { text: '🚗 車輛狀態', callback_data: 'cmd_car' },
        ]);
    }

    // 貸款/稅務
    if (/貸款|房貸|利率|稅|loan|tax/i.test(combined)) {
        buttons.push([
            { text: '🏦 貸款管理', callback_data: 'cmd_loan' },
            { text: '📋 稅務估算', callback_data: 'cmd_tax' },
        ]);
    }

    // 如果是特定探員，加上探員切換提示
    if (activeAgent && activeAgent !== 'butler') {
        buttons.push([
            { text: '🤖 切回小秘書', callback_data: 'agent_switch_butler' },
            { text: '👥 探員目錄', callback_data: 'cmd_agents' },
        ]);
    }

    // 保底：永遠至少顯示主選單按鈕
    if (buttons.length === 0) {
        buttons.push([{ text: '📋 主選單', callback_data: 'cmd_menu' }]);
    } else {
        // 不超過 4 行按鈕，最後加上主選單
        if (buttons.length > 3) buttons.splice(3);
        buttons.push([{ text: '📋 主選單', callback_data: 'cmd_menu' }]);
    }

    return buttons;
}

/**
 * 根據 tool call 類型推薦後續操作按鈕。
 */
function buildToolFollowUpKeyboard(
    toolCalls: Array<{ name: string; args: Record<string, unknown> }>
): InlineKeyboardButton[][] {
    const buttons: InlineKeyboardButton[][] = [];
    const toolNames = toolCalls.map(t => t.name);

    if (toolNames.includes('record_expense') || toolNames.includes('get_spending')) {
        buttons.push([
            { text: '💰 繼續記帳', callback_data: 'cmd_expense' },
            { text: '💳 本月概況', callback_data: 'cmd_balance' },
        ]);
    }
    if (toolNames.includes('add_investment') || toolNames.includes('get_portfolio')) {
        buttons.push([
            { text: '📈 投資組合', callback_data: 'cmd_invest' },
            { text: '🤖 投資建議', callback_data: 'advice_topic_portfolio_review' },
        ]);
    }
    if (toolNames.includes('add_event') || toolNames.includes('get_schedule')) {
        buttons.push([{ text: '📋 今日行程', callback_data: 'cmd_today' }]);
    }
    if (toolNames.includes('record_weight')) {
        buttons.push([{ text: '🏃 健康快照', callback_data: 'cmd_health' }]);
    }
    if (toolNames.includes('record_fuel')) {
        buttons.push([{ text: '🚗 車輛狀態', callback_data: 'cmd_car' }]);
    }

    buttons.push([{ text: '📋 主選單', callback_data: 'cmd_menu' }]);
    return buttons;
}
