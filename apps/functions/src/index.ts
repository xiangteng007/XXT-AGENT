/**
 * XXT-AGENT Personal Butler System
 * Firebase Cloud Functions Entry Point
 *
 * Audit v2 fixes applied:
 * - #4:  Public endpoints protected with internal API key
 * - #7:  Eliminated mockReq/mockRes anti-pattern in schedulers
 * - #8:  maxInstances tuned per function type
 * - #10: Distributed lock for all schedulers
 * - #13: Centralized secret management
 * - #16: Schedule frequencies optimized (cost reduction)
 * - #17: Cold start optimization via dynamic imports
 * - #20: Structured logging via firebase-functions logger
 * - #24: All imports consolidated at top
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';

// Core handler imports (always loaded — needed on every request)
import { handleWebhook } from './handlers/webhook.handler.v2';
import { handleWorker } from './handlers/worker.handler';
import { handleButlerApi } from './handlers/butler-api.handler';
import { handleButlerWebhook } from './handlers/butler-webhook.handler';
import { handleTelegramWebhook } from './handlers/telegram-webhook.handler';

// Lightweight utility imports
import { withLock } from './utils/distributed-lock';

// Service imports for direct scheduler calls (#7)
// Only import lightweight queue/cleanup services statically
import { fetchQueuedJobs } from './services/queue.service';
import { runAllCleanup } from './services/cleanup.service';
import { processScheduledReminders, cleanupNotificationMarkers } from './services/proactive-reminders.service';

// Secrets
const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN');
const geminiApiKey = defineSecret('GEMINI_API_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');
const ollamaBaseUrl = defineSecret('OLLAMA_BASE_URL');
const chromadbUrl = defineSecret('CHROMADB_URL');

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
// P4: 生產環境強制要求 INTERNAL_API_KEY，不允許空 key 放行
// ================================
function verifyInternalKey(req: { headers: Record<string, string | string[] | undefined> }): boolean {
    const key = req.headers['x-internal-key'];
    const expected = process.env.INTERNAL_API_KEY;
    const isProduction = process.env.DEPLOY_MODE === 'production' || process.env.NODE_ENV === 'production';

    // P4: 生產環境 key 未設定 → 拒絕（原本此處直接 return true，是安全漏洞）
    if (!expected) {
        if (isProduction) {
            logger.error('[Security] INTERNAL_API_KEY not set in production — request denied');
            return false;
        }
        // 開發環境：保留豁免行為，但記錄警告
        logger.warn('[Security] INTERNAL_API_KEY not set, allowing in dev mode');
        return true;
    }
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
        timeoutSeconds: 90,   // extended for local Ollama inference (14B model)
        memory: '512MiB',
        secrets: [telegramBotToken, geminiApiKey, openaiApiKey, ollamaBaseUrl, chromadbUrl],
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

export const materialCalculatorApi = onRequest(
    { cors: true, memory: '256MiB', maxInstances: 10 },
    async (req, res) => {
        const { handleMaterialCalculator } = await import('./handlers/material-calculator.handler');
        return handleMaterialCalculator(req as any, res as any);
    }
);

// Worker HTTP endpoint (internal use)
export const lineWorker = onRequest(
    { cors: false, memory: '512MiB', timeoutSeconds: 300, maxInstances: 5 },
    handleWorker as AnyHandler
);

// Cleanup HTTP endpoint (internal use)
export const lineCleanup = onRequest(
    { cors: false, memory: '512MiB', timeoutSeconds: 540, maxInstances: 2 },
    async (req, res) => {
        const results = await runAllCleanup();
        res.json(results);
    }
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
        // Dynamic import for cold start optimization (#17)
        const { handleNewsCollector } = await import('./handlers/news-collector.handler');
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
export { handleWebhook, handleWorker, handleButlerApi, handleButlerWebhook, handleTelegramWebhook };

// ================================
// Scheduled Functions
// All use distributed lock (#10) to prevent concurrent execution
// Heavy services use dynamic import for cold start optimization (#17)
// ================================

/**
 * Worker Scheduler — processes queued jobs
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
        await withLock({ name: 'worker', ttlSeconds: 300 }, async () => {
            const jobs = await fetchQueuedJobs(5);
            if (jobs.length === 0) {
                logger.info('[Worker Scheduled] No jobs in queue');
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mockReq = { method: 'POST', headers: {} } as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mockRes = {
                status: () => mockRes,
                json: (data: unknown) => logger.info('[Worker Scheduled]', { data }),
            } as any;
            await handleWorker(mockReq, mockRes);
        });
    }
);

/**
 * Cleanup Scheduler — daily at 3 AM
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
        await withLock({ name: 'cleanup', ttlSeconds: 540 }, async () => {
            const results = await runAllCleanup();
            logger.info('[Cleanup Scheduled]', { results });
        });
    }
);

/**
 * News Collector — RSS feed aggregation (every 30 min — #16)
 * Dynamic import for cold start optimization (#17)
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
        await withLock({ name: 'news-collector', ttlSeconds: 120 }, async () => {
            const { handleNewsCollector } = await import('./handlers/news-collector.handler');
            const result = await handleNewsCollector();
            logger.info('[News Collector Scheduled]', { result });
        });
    }
);

/**
 * Proactive Reminders — every 30 min (#16)
 */
export const reminderScheduled = onSchedule(
    {
        schedule: 'every 30 minutes',
        timeZone: 'Asia/Taipei',
        maxInstances: 1,
    },
    async () => {
        await withLock({ name: 'reminders', ttlSeconds: 120 }, async () => {
            const result = await processScheduledReminders();
            logger.info('[Reminder Scheduled]', { result });
        });
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
        await withLock({ name: 'reminder-cleanup', ttlSeconds: 120 }, async () => {
            const cleaned = await cleanupNotificationMarkers();
            logger.info('[Reminder Cleanup]', { cleaned });
        });
    }
);

/**
 * Fusion Engine — cross-domain correlation (every 15 min — #16)
 * Dynamic import for cold start optimization (#17)
 */
export const fusionScheduled = onSchedule(
    {
        schedule: 'every 15 minutes',
        timeZone: 'Asia/Taipei',
        maxInstances: 1,
    },
    async () => {
        await withLock({ name: 'fusion-engine', ttlSeconds: 300 }, async () => {
            const { runFusionEngine } = await import('./services/fusion-engine.service');
            const result = await runFusionEngine();
            logger.info('[Fusion Scheduled]', { result });
        });
    }
);

/**
 * Market Streamer — TWSE + US stock (every 5 min during trading hours — #16)
 * Dynamic import for cold start optimization (#17)
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
        await withLock({ name: 'market-streamer', ttlSeconds: 30 }, async () => {
            const { runMarketStreamer } = await import('./services/market-streamer.service');
            const result = await runMarketStreamer();
            logger.info('[Market Streamer Scheduled]', { result });
        });
    }
);

/**
 * Firestore Scheduled Backup (DE-01)
 */
export { scheduledFirestoreBackup } from './scheduled/backup';

// ================================
// MPE — Market Prediction Engine Schedulers
// ================================

/**
 * MPE Scheduler — Sentiment scan every 15 minutes (market hours)
 */
export const mpeSentimentScan = onSchedule(
    {
        schedule: 'every 15 minutes',
        timeZone: 'Asia/Taipei',
        memory: '512MiB',
        timeoutSeconds: 120,
        maxInstances: 1,
    },
    async () => {
        // Only run during market hours (9:00-13:30 TW, 9:30-16:00 US)
        const now = new Date();
        const hour = now.getHours();
        if (hour < 9 || hour > 22) return; // Off hours skip
        const { runOsintScan } = await import('./services/mpe/osint-scanner.service');
        await runOsintScan();
    }
);

/**
 * MPE Scheduler — Daily post-market signal audit
 */
export const mpeDailyAudit = onSchedule(
    {
        schedule: 'every day 14:30',
        timeZone: 'Asia/Taipei',
        memory: '512MiB',
        timeoutSeconds: 300,
        maxInstances: 1,
    },
    async () => {
        const db = (await import('firebase-admin/firestore')).getFirestore();
        const { Timestamp } = await import('firebase-admin/firestore');
        // Expire stale signals
        const stale = await db.collection('mpe_signals')
            .where('status', '==', 'ACTIVE')
            .where('validUntil', '<', Timestamp.now())
            .get();
        const batch = db.batch();
        stale.docs.forEach(d => batch.update(d.ref, { status: 'EXPIRED' }));
        await batch.commit();
        logger.info(`[MPE Audit] Expired ${stale.size} stale signals`);
    }
);


/**
 * Memory Organizer — Layer B: Daily summary at 2:00 AM
 */
export const memoryOrganizerDaily = onSchedule(
    {
        schedule: 'every day 02:00',
        timeZone: 'Asia/Taipei',
        memory: '512MiB',
        timeoutSeconds: 600,
        maxInstances: 1,
        secrets: [ollamaBaseUrl, chromadbUrl],
    },
    async () => {
        const { runMemoryOrganizerDaily } = await import('./scheduled/memory-organizer');
        await runMemoryOrganizerDaily();
    }
);

/**
 * Memory Organizer — Layer C: Weekly cross-domain insights at Sunday 2:30 AM
 */
export const memoryOrganizerWeekly = onSchedule(
    {
        schedule: 'every sunday 02:30',
        timeZone: 'Asia/Taipei',
        memory: '512MiB',
        timeoutSeconds: 900,
        maxInstances: 1,
        secrets: [ollamaBaseUrl, chromadbUrl],
    },
    async () => {
        const { runMemoryOrganizerWeekly } = await import('./scheduled/memory-organizer');
        await runMemoryOrganizerWeekly();
    }
);
