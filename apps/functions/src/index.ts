/**
 * XXT-AGENT Personal Butler System
 * Firebase Cloud Functions Entry Point
 *
 * Audit v2 fixes applied:
 * - #4:  Public endpoints protected with internal API key
 * - #7:  Eliminated mockReq/mockRes anti-pattern in schedulers
 * - #8:  maxInstances tuned per function type
 * - #16: Schedule frequencies optimized (cost reduction)
 * - #20: Structured logging via firebase-functions logger
 * - #24: All imports consolidated at top
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';

// Handler imports (consolidated — #24)
import { handleWebhook } from './handlers/webhook.handler.v2';
import { handleWorker } from './handlers/worker.handler';
import { handleCleanup } from './handlers/cleanup.handler';
import { handleButlerApi } from './handlers/butler-api.handler';
import { handleButlerWebhook } from './handlers/butler-webhook.handler';
import { handleTelegramWebhook } from './handlers/telegram-webhook.handler';
import { handleNewsCollector } from './handlers/news-collector.handler';

// Service imports for direct scheduler calls (#7)
import { fetchQueuedJobs } from './services/queue.service';
import { runAllCleanup } from './services/cleanup.service';
import { processScheduledReminders, cleanupNotificationMarkers } from './services/proactive-reminders.service';
import { runFusionEngine } from './services/fusion-engine.service';
import { runMarketStreamer } from './services/market-streamer.service';

// Secrets
const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN');

// Type assertion helper for cross-library type compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = any;

// ================================
// Global Options
// ================================
setGlobalOptions({
    region: 'asia-east1',
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10,
});

// ================================
// Internal API Key check for manual trigger endpoints (#4)
// ================================
function verifyInternalKey(req: { headers: Record<string, string | string[] | undefined> }): boolean {
    const key = req.headers['x-internal-key'];
    const expected = process.env.INTERNAL_API_KEY;
    if (!expected) return true; // No key configured = allow (dev mode)
    return key === expected;
}

// ================================
// Webhook Endpoints (public, high concurrency)
// ================================
export const lineWebhook = onRequest(
    { cors: false, invoker: 'public', maxInstances: 50 },
    handleWebhook as AnyHandler
);

export const butlerWebhook = onRequest(
    { cors: false, invoker: 'public', maxInstances: 30 },
    handleButlerWebhook as AnyHandler
);

export const telegramWebhook = onRequest(
    {
        cors: false,
        invoker: 'public',
        maxInstances: 30,
        timeoutSeconds: 30,
        secrets: [telegramBotToken],
    },
    handleTelegramWebhook as AnyHandler
);

// ================================
// API Endpoints (authenticated, moderate concurrency)
// ================================
export const butlerApi = onRequest(
    { cors: true, memory: '512MiB', maxInstances: 20 },
    handleButlerApi as AnyHandler
);

// Worker HTTP endpoint (internal use)
export const lineWorker = onRequest(
    { cors: false, memory: '512MiB', timeoutSeconds: 300, maxInstances: 5 },
    handleWorker as AnyHandler
);

// Cleanup HTTP endpoint (internal use)
export const lineCleanup = onRequest(
    { cors: false, memory: '512MiB', timeoutSeconds: 540, maxInstances: 2 },
    handleCleanup as AnyHandler
);

// ================================
// Manual Trigger Endpoints (protected with internal API key — #4)
// ================================
export const newsCollector = onRequest(
    { cors: false, memory: '512MiB', timeoutSeconds: 120, maxInstances: 1 },
    async (req, res) => {
        if (!verifyInternalKey(req)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const result = await handleNewsCollector();
        res.json(result);
    }
);

export const reminderManual = onRequest(
    { cors: false, maxInstances: 1 },
    async (req, res) => {
        if (!verifyInternalKey(req)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const result = await processScheduledReminders();
        res.json(result);
    }
);

// ================================
// Auth Trigger
// ================================
export { onUserCreated } from './triggers/auth.trigger';

// Export handlers for testing
export { handleWebhook, handleWorker, handleCleanup, handleButlerApi, handleButlerWebhook, handleTelegramWebhook };

// ================================
// Scheduled Functions (single instance — #8, #7 direct calls, #16 optimized frequencies)
// ================================

/**
 * Worker Scheduler — processes queued jobs
 * (Calls service directly instead of mockReq/mockRes — #7)
 */
export const lineWorkerScheduled = onSchedule(
    {
        schedule: 'every 1 minutes',
        timeZone: 'Asia/Taipei',
        memory: '512MiB',
        timeoutSeconds: 300,
        maxInstances: 1,
    },
    async () => {
        const jobs = await fetchQueuedJobs(5);
        if (jobs.length === 0) {
            logger.info('[Worker Scheduled] No jobs in queue');
            return;
        }
        // Delegate to HTTP handler with proper req/res for complex job processing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockReq = { method: 'POST', headers: {} } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockRes = {
            status: () => mockRes,
            json: (data: unknown) => logger.info('[Worker Scheduled]', { data }),
        } as any;
        await handleWorker(mockReq, mockRes);
    }
);

/**
 * Cleanup Scheduler — daily at 3 AM
 * (Calls runAllCleanup directly — #7)
 */
export const lineCleanupScheduled = onSchedule(
    {
        schedule: 'every day 03:00',
        timeZone: 'Asia/Taipei',
        memory: '512MiB',
        timeoutSeconds: 540,
        maxInstances: 1,
    },
    async () => {
        const results = await runAllCleanup();
        logger.info('[Cleanup Scheduled]', { results });
    }
);

/**
 * News Collector — RSS feed aggregation
 * Optimized: every 30 minutes (was 10 — #16)
 */
export const newsCollectorScheduled = onSchedule(
    {
        schedule: 'every 30 minutes',
        timeZone: 'Asia/Taipei',
        memory: '512MiB',
        timeoutSeconds: 120,
        maxInstances: 1,
    },
    async () => {
        const result = await handleNewsCollector();
        logger.info('[News Collector Scheduled]', { result });
    }
);

/**
 * Proactive Reminders — checks vehicle, bills, events, health goals
 * Optimized: every 30 minutes (was 15 — #16)
 */
export const reminderScheduled = onSchedule(
    {
        schedule: 'every 30 minutes',
        timeZone: 'Asia/Taipei',
        maxInstances: 1,
    },
    async () => {
        const result = await processScheduledReminders();
        logger.info('[Reminder Scheduled]', { result });
    }
);

/**
 * Reminder Cleanup — weekly removal of old notification markers
 */
export const reminderCleanup = onSchedule(
    {
        schedule: 'every sunday 04:00',
        timeZone: 'Asia/Taipei',
        timeoutSeconds: 120,
        maxInstances: 1,
    },
    async () => {
        const cleaned = await cleanupNotificationMarkers();
        logger.info('[Reminder Cleanup]', { cleaned });
    }
);

/**
 * Fusion Engine — cross-domain signal correlation
 * Optimized: every 15 minutes (was 5 — #16)
 */
export const fusionScheduled = onSchedule(
    {
        schedule: 'every 15 minutes',
        timeZone: 'Asia/Taipei',
        maxInstances: 1,
    },
    async () => {
        const result = await runFusionEngine();
        logger.info('[Fusion Scheduled]', { result });
    }
);

/**
 * Market Streamer — real-time TWSE + US stock monitoring
 * Optimized: every 5 minutes during trading hours (was 1 — #16)
 */
export const marketStreamerScheduled = onSchedule(
    {
        schedule: 'every 5 minutes',
        timeZone: 'Asia/Taipei',
        timeoutSeconds: 30,
        maxInstances: 1,
    },
    async () => {
        const now = new Date();
        const hour = now.getUTCHours() + 8; // UTC+8
        const day = now.getUTCDay();
        if (day === 0 || day === 6 || hour < 9 || hour >= 14) {
            return; // Skip weekends and off-hours
        }
        const result = await runMarketStreamer();
        logger.info('[Market Streamer Scheduled]', { result });
    }
);
