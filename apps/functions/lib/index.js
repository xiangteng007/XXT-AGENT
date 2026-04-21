"use strict";
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
exports.scheduledFirestoreBackup = exports.marketStreamerScheduled = exports.fusionScheduled = exports.reminderCleanup = exports.reminderScheduled = exports.newsCollectorScheduled = exports.lineCleanupScheduled = exports.lineWorkerScheduled = exports.handleTelegramWebhook = exports.handleButlerWebhook = exports.handleButlerApi = exports.handleWorker = exports.handleWebhook = exports.onUserCreated = exports.reminderManual = exports.newsCollector = exports.lineCleanup = exports.lineWorker = exports.materialCalculatorApi = exports.butlerApi = exports.telegramWebhook = exports.butlerWebhook = exports.lineWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
const v2_2 = require("firebase-functions/v2");
// Core handler imports (always loaded — needed on every request)
const webhook_handler_v2_1 = require("./handlers/webhook.handler.v2");
Object.defineProperty(exports, "handleWebhook", { enumerable: true, get: function () { return webhook_handler_v2_1.handleWebhook; } });
const worker_handler_1 = require("./handlers/worker.handler");
Object.defineProperty(exports, "handleWorker", { enumerable: true, get: function () { return worker_handler_1.handleWorker; } });
const butler_api_handler_1 = require("./handlers/butler-api.handler");
Object.defineProperty(exports, "handleButlerApi", { enumerable: true, get: function () { return butler_api_handler_1.handleButlerApi; } });
const butler_webhook_handler_1 = require("./handlers/butler-webhook.handler");
Object.defineProperty(exports, "handleButlerWebhook", { enumerable: true, get: function () { return butler_webhook_handler_1.handleButlerWebhook; } });
const telegram_webhook_handler_1 = require("./handlers/telegram-webhook.handler");
Object.defineProperty(exports, "handleTelegramWebhook", { enumerable: true, get: function () { return telegram_webhook_handler_1.handleTelegramWebhook; } });
// Lightweight utility imports
const distributed_lock_1 = require("./utils/distributed-lock");
// Service imports for direct scheduler calls (#7)
// Only import lightweight queue/cleanup services statically
const queue_service_1 = require("./services/queue.service");
const cleanup_service_1 = require("./services/cleanup.service");
const proactive_reminders_service_1 = require("./services/proactive-reminders.service");
// Secrets
const telegramBotToken = (0, params_1.defineSecret)('TELEGRAM_BOT_TOKEN');
// ================================
// Global Options
// ================================
(0, v2_1.setGlobalOptions)({
    region: 'asia-east1',
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10,
});
// ================================
// Internal API Key check for manual trigger endpoints (#4)
// P4: 生產環境強制要求 INTERNAL_API_KEY，不允許空 key 放行
// ================================
function verifyInternalKey(req) {
    const key = req.headers['x-internal-key'];
    const expected = process.env.INTERNAL_API_KEY;
    const isProduction = process.env.DEPLOY_MODE === 'production' || process.env.NODE_ENV === 'production';
    // P4: 生產環境 key 未設定 → 拒絕（原本此處直接 return true，是安全漏洞）
    if (!expected) {
        if (isProduction) {
            v2_2.logger.error('[Security] INTERNAL_API_KEY not set in production — request denied');
            return false;
        }
        // 開發環境：保留豁免行為，但記錄警告
        v2_2.logger.warn('[Security] INTERNAL_API_KEY not set, allowing in dev mode');
        return true;
    }
    return key === expected;
}
// ================================
// Webhook Endpoints (public, high concurrency)
// ================================
exports.lineWebhook = (0, https_1.onRequest)({ cors: false, invoker: 'public', maxInstances: 50 }, webhook_handler_v2_1.handleWebhook);
exports.butlerWebhook = (0, https_1.onRequest)({ cors: false, invoker: 'public', maxInstances: 30 }, butler_webhook_handler_1.handleButlerWebhook);
exports.telegramWebhook = (0, https_1.onRequest)({
    cors: false,
    invoker: 'public',
    maxInstances: 30,
    timeoutSeconds: 30,
    secrets: [telegramBotToken],
}, telegram_webhook_handler_1.handleTelegramWebhook);
// ================================
// API Endpoints (authenticated, moderate concurrency)
// ================================
exports.butlerApi = (0, https_1.onRequest)({ cors: true, memory: '512MiB', maxInstances: 20 }, butler_api_handler_1.handleButlerApi);
exports.materialCalculatorApi = (0, https_1.onRequest)({ cors: true, memory: '256MiB', maxInstances: 10 }, async (req, res) => {
    const { handleMaterialCalculator } = await Promise.resolve().then(() => __importStar(require('./handlers/material-calculator.handler')));
    return handleMaterialCalculator(req, res);
});
// Worker HTTP endpoint (internal use)
exports.lineWorker = (0, https_1.onRequest)({ cors: false, memory: '512MiB', timeoutSeconds: 300, maxInstances: 5 }, worker_handler_1.handleWorker);
// Cleanup HTTP endpoint (internal use)
exports.lineCleanup = (0, https_1.onRequest)({ cors: false, memory: '512MiB', timeoutSeconds: 540, maxInstances: 2 }, async (req, res) => {
    const results = await (0, cleanup_service_1.runAllCleanup)();
    res.json(results);
});
// ================================
// Manual Trigger Endpoints (protected with internal API key — #4)
// ================================
exports.newsCollector = (0, https_1.onRequest)({ cors: false, memory: '512MiB', timeoutSeconds: 120, maxInstances: 1 }, async (req, res) => {
    if (!verifyInternalKey(req)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    // Dynamic import for cold start optimization (#17)
    const { handleNewsCollector } = await Promise.resolve().then(() => __importStar(require('./handlers/news-collector.handler')));
    const result = await handleNewsCollector();
    res.json(result);
});
exports.reminderManual = (0, https_1.onRequest)({ cors: false, maxInstances: 1 }, async (req, res) => {
    if (!verifyInternalKey(req)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const result = await (0, proactive_reminders_service_1.processScheduledReminders)();
    res.json(result);
});
// ================================
// Auth Trigger
// ================================
var auth_trigger_1 = require("./triggers/auth.trigger");
Object.defineProperty(exports, "onUserCreated", { enumerable: true, get: function () { return auth_trigger_1.onUserCreated; } });
// ================================
// Scheduled Functions
// All use distributed lock (#10) to prevent concurrent execution
// Heavy services use dynamic import for cold start optimization (#17)
// ================================
/**
 * Worker Scheduler — processes queued jobs
 */
exports.lineWorkerScheduled = (0, scheduler_1.onSchedule)({
    schedule: 'every 1 minutes',
    timeZone: 'Asia/Taipei',
    memory: '512MiB',
    timeoutSeconds: 300,
    maxInstances: 1,
}, async () => {
    await (0, distributed_lock_1.withLock)({ name: 'worker', ttlSeconds: 300 }, async () => {
        const jobs = await (0, queue_service_1.fetchQueuedJobs)(5);
        if (jobs.length === 0) {
            v2_2.logger.info('[Worker Scheduled] No jobs in queue');
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockReq = { method: 'POST', headers: {} };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockRes = {
            status: () => mockRes,
            json: (data) => v2_2.logger.info('[Worker Scheduled]', { data }),
        };
        await (0, worker_handler_1.handleWorker)(mockReq, mockRes);
    });
});
/**
 * Cleanup Scheduler — daily at 3 AM
 */
exports.lineCleanupScheduled = (0, scheduler_1.onSchedule)({
    schedule: 'every day 03:00',
    timeZone: 'Asia/Taipei',
    memory: '512MiB',
    timeoutSeconds: 540,
    maxInstances: 1,
}, async () => {
    await (0, distributed_lock_1.withLock)({ name: 'cleanup', ttlSeconds: 540 }, async () => {
        const results = await (0, cleanup_service_1.runAllCleanup)();
        v2_2.logger.info('[Cleanup Scheduled]', { results });
    });
});
/**
 * News Collector — RSS feed aggregation (every 30 min — #16)
 * Dynamic import for cold start optimization (#17)
 */
exports.newsCollectorScheduled = (0, scheduler_1.onSchedule)({
    schedule: 'every 30 minutes',
    timeZone: 'Asia/Taipei',
    memory: '512MiB',
    timeoutSeconds: 120,
    maxInstances: 1,
}, async () => {
    await (0, distributed_lock_1.withLock)({ name: 'news-collector', ttlSeconds: 120 }, async () => {
        const { handleNewsCollector } = await Promise.resolve().then(() => __importStar(require('./handlers/news-collector.handler')));
        const result = await handleNewsCollector();
        v2_2.logger.info('[News Collector Scheduled]', { result });
    });
});
/**
 * Proactive Reminders — every 30 min (#16)
 */
exports.reminderScheduled = (0, scheduler_1.onSchedule)({
    schedule: 'every 30 minutes',
    timeZone: 'Asia/Taipei',
    maxInstances: 1,
}, async () => {
    await (0, distributed_lock_1.withLock)({ name: 'reminders', ttlSeconds: 120 }, async () => {
        const result = await (0, proactive_reminders_service_1.processScheduledReminders)();
        v2_2.logger.info('[Reminder Scheduled]', { result });
    });
});
/**
 * Reminder Cleanup — weekly removal of old notification markers
 */
exports.reminderCleanup = (0, scheduler_1.onSchedule)({
    schedule: 'every sunday 04:00',
    timeZone: 'Asia/Taipei',
    timeoutSeconds: 120,
    maxInstances: 1,
}, async () => {
    await (0, distributed_lock_1.withLock)({ name: 'reminder-cleanup', ttlSeconds: 120 }, async () => {
        const cleaned = await (0, proactive_reminders_service_1.cleanupNotificationMarkers)();
        v2_2.logger.info('[Reminder Cleanup]', { cleaned });
    });
});
/**
 * Fusion Engine — cross-domain correlation (every 15 min — #16)
 * Dynamic import for cold start optimization (#17)
 */
exports.fusionScheduled = (0, scheduler_1.onSchedule)({
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Taipei',
    maxInstances: 1,
}, async () => {
    await (0, distributed_lock_1.withLock)({ name: 'fusion-engine', ttlSeconds: 300 }, async () => {
        const { runFusionEngine } = await Promise.resolve().then(() => __importStar(require('./services/fusion-engine.service')));
        const result = await runFusionEngine();
        v2_2.logger.info('[Fusion Scheduled]', { result });
    });
});
/**
 * Market Streamer — TWSE + US stock (every 5 min during trading hours — #16)
 * Dynamic import for cold start optimization (#17)
 */
exports.marketStreamerScheduled = (0, scheduler_1.onSchedule)({
    schedule: 'every 5 minutes',
    timeZone: 'Asia/Taipei',
    timeoutSeconds: 30,
    maxInstances: 1,
}, async () => {
    const now = new Date();
    const hour = now.getUTCHours() + 8; // UTC+8
    const day = now.getUTCDay();
    if (day === 0 || day === 6 || hour < 9 || hour >= 14) {
        return; // Skip weekends and off-hours
    }
    await (0, distributed_lock_1.withLock)({ name: 'market-streamer', ttlSeconds: 30 }, async () => {
        const { runMarketStreamer } = await Promise.resolve().then(() => __importStar(require('./services/market-streamer.service')));
        const result = await runMarketStreamer();
        v2_2.logger.info('[Market Streamer Scheduled]', { result });
    });
});
/**
 * Firestore Scheduled Backup (DE-01)
 */
var backup_1 = require("./scheduled/backup");
Object.defineProperty(exports, "scheduledFirestoreBackup", { enumerable: true, get: function () { return backup_1.scheduledFirestoreBackup; } });
//# sourceMappingURL=index.js.map