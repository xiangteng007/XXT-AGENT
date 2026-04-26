/**
 * Telegram Webhook Handler — v3 Modular Architecture (完整版)
 *
 * Entry point for all Telegram Bot updates. All sub-logic lives in:
 *
 *   handlers/telegram/commands.ts  — /command handlers
 *   handlers/telegram/callbacks.ts — inline keyboard callbacks + tool executor
 *   handlers/telegram/api.ts       — Telegram HTTP helpers (sendMessage, etc.)
 *   handlers/telegram/media.ts     — voice STT, location, photo/OCR handlers
 *   handlers/telegram/types.ts     — shared TypeScript types
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
import { generateAIResponseWithTools } from '../services/butler-ai.service';
import { retrieveRAGContext } from '../services/rag-context.service';

// ---- Modular V3 sub-modules ----
import { handleCommand } from './telegram/commands';
import { handleCallbackQuery, executeTelegramToolCalls } from './telegram/callbacks';
import { sendMessage, sendChatAction, getLinkedFirebaseUid } from './telegram/api';
import type { TelegramUpdate, TelegramMessage } from './telegram/types';

// ---- V3 Media handlers (extracted from legacy inline code) ----
import {
    handleVoiceMessage,
    handleLocationMessage,
    handlePhotoMessage,
} from './telegram/media';

const db = getFirestore();

// ================================
// Main Webhook Handler
// ================================

export async function handleTelegramWebhook(req: Request, res: Response): Promise<void> {
    // Immediate 200 — prevents Telegram from retrying
    res.status(200).send('OK');

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
// Natural Language → AI Inference
// ================================

export async function handleNaturalLanguage(
    chatId: number,
    telegramUserId: number,
    text: string
): Promise<void> {
    const linkedUid = await getLinkedFirebaseUid(telegramUserId);
    const userId = linkedUid || `telegram:${telegramUserId}`;

    await sendChatAction(chatId, 'typing');
    await appendMessage(userId, 'user', text);

    // 並行取得：短期對話歷史 + 當前 session + NAS 長期語義記憶 (ChromaDB)
    const [history, session, ragContext] = await Promise.all([
        getPreviousMessages(userId),
        getSession(userId),
        retrieveRAGContext(userId, text),
    ]);

    // 組合 context：短期歷史 + RAG 長期記憶
    const fullContext = history.join('\n') + ragContext;

    const response = await generateAIResponseWithTools(
        text,
        userId,
        fullContext,
        session.activeAgent
    );

    if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await executeTelegramToolCalls(userId, response.toolCalls);
        const combined = toolResults.join('\n\n');
        await appendMessage(userId, 'assistant', combined);
        await sendMessage(chatId, combined);
    } else {
        const aiText = response.text || '抱歉，我無法理解您的意思。';
        await appendMessage(userId, 'assistant', aiText);
        await sendMessage(chatId, aiText);
    }
}
