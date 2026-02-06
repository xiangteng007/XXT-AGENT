"use strict";
/**
 * LINE to Notion Multi-Tenant Platform
 * Firebase Cloud Functions Entry Point
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.newsCollector = exports.newsCollectorScheduled = exports.handleTelegramWebhook = exports.handleButlerWebhook = exports.handleButlerApi = exports.handleCleanup = exports.handleWorker = exports.handleWebhook = exports.telegramWebhook = exports.butlerWebhook = exports.butlerApi = exports.lineCleanupScheduled = exports.lineCleanup = exports.lineWorkerScheduled = exports.lineWorker = exports.lineWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
const webhook_handler_v2_1 = require("./handlers/webhook.handler.v2");
Object.defineProperty(exports, "handleWebhook", { enumerable: true, get: function () { return webhook_handler_v2_1.handleWebhook; } });
const worker_handler_1 = require("./handlers/worker.handler");
Object.defineProperty(exports, "handleWorker", { enumerable: true, get: function () { return worker_handler_1.handleWorker; } });
const cleanup_handler_1 = require("./handlers/cleanup.handler");
Object.defineProperty(exports, "handleCleanup", { enumerable: true, get: function () { return cleanup_handler_1.handleCleanup; } });
const butler_api_handler_1 = require("./handlers/butler-api.handler");
Object.defineProperty(exports, "handleButlerApi", { enumerable: true, get: function () { return butler_api_handler_1.handleButlerApi; } });
const butler_webhook_handler_1 = require("./handlers/butler-webhook.handler");
Object.defineProperty(exports, "handleButlerWebhook", { enumerable: true, get: function () { return butler_webhook_handler_1.handleButlerWebhook; } });
// Set global options for all functions
(0, v2_1.setGlobalOptions)({
    region: 'asia-east1', // Taiwan
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10,
});
/**
 * LINE Webhook Endpoint
 */
exports.lineWebhook = (0, https_1.onRequest)({
    cors: false,
    invoker: 'public',
}, webhook_handler_v2_1.handleWebhook);
/**
 * Worker Endpoint
 */
exports.lineWorker = (0, https_1.onRequest)({
    cors: false,
    memory: '512MiB',
    timeoutSeconds: 300,
}, worker_handler_1.handleWorker);
/**
 * Scheduled Worker
 */
exports.lineWorkerScheduled = (0, scheduler_1.onSchedule)({
    schedule: 'every 1 minutes',
    timeZone: 'Asia/Taipei',
    memory: '512MiB',
    timeoutSeconds: 300,
}, async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockReq = { method: 'POST', headers: {} };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockRes = {
        status: () => mockRes,
        json: (data) => console.log('[Scheduled Worker]', data),
    };
    await (0, worker_handler_1.handleWorker)(mockReq, mockRes);
});
/**
 * Cleanup Endpoint
 */
exports.lineCleanup = (0, https_1.onRequest)({
    cors: false,
    memory: '512MiB',
    timeoutSeconds: 540,
}, cleanup_handler_1.handleCleanup);
/**
 * Scheduled Cleanup
 */
exports.lineCleanupScheduled = (0, scheduler_1.onSchedule)({
    schedule: 'every day 03:00',
    timeZone: 'Asia/Taipei',
    memory: '512MiB',
    timeoutSeconds: 540,
}, async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockReq = { method: 'POST', headers: {} };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockRes = {
        status: () => mockRes,
        json: (data) => console.log('[Scheduled Cleanup]', data),
    };
    await (0, cleanup_handler_1.handleCleanup)(mockReq, mockRes);
});
/**
 * Butler API Endpoint
 */
exports.butlerApi = (0, https_1.onRequest)({
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 60,
}, butler_api_handler_1.handleButlerApi);
/**
 * Butler LINE Webhook Endpoint
 */
exports.butlerWebhook = (0, https_1.onRequest)({
    cors: false,
    invoker: 'public',
    memory: '256MiB',
}, butler_webhook_handler_1.handleButlerWebhook);
/**
 * Telegram Bot Webhook Endpoint
 * Handles incoming updates from Telegram Bot API
 */
const telegram_webhook_handler_1 = require("./handlers/telegram-webhook.handler");
Object.defineProperty(exports, "handleTelegramWebhook", { enumerable: true, get: function () { return telegram_webhook_handler_1.handleTelegramWebhook; } });
const params_1 = require("firebase-functions/params");
// Define secrets from Secret Manager
const telegramBotToken = (0, params_1.defineSecret)('TELEGRAM_BOT_TOKEN');
exports.telegramWebhook = (0, https_1.onRequest)({
    cors: false,
    invoker: 'public',
    memory: '256MiB',
    timeoutSeconds: 30,
    secrets: [telegramBotToken],
}, telegram_webhook_handler_1.handleTelegramWebhook);
// Auth triggers - temporarily disabled until Firebase Auth is enabled in project
// To re-enable: uncomment and ensure Firebase Auth is enabled in the GCP project
// export { onUserCreated } from './triggers/auth.trigger';
/**
 * News Collector - Scheduled RSS Feed Aggregation
 * Runs every 10 minutes to collect news from RSS feeds
 * and store in Firestore for dashboard display.
 */
const news_collector_handler_1 = require("./handlers/news-collector.handler");
exports.newsCollectorScheduled = (0, scheduler_1.onSchedule)({
    schedule: 'every 10 minutes',
    timeZone: 'Asia/Taipei',
    memory: '512MiB',
    timeoutSeconds: 120,
}, async () => {
    const result = await (0, news_collector_handler_1.handleNewsCollector)();
    console.log('[News Collector Scheduled]', result);
});
// Manual trigger endpoint for news collector (for testing)
exports.newsCollector = (0, https_1.onRequest)({
    cors: false,
    invoker: 'public',
    memory: '512MiB',
    timeoutSeconds: 120,
}, async (req, res) => {
    const result = await (0, news_collector_handler_1.handleNewsCollector)();
    res.json(result);
});
//# sourceMappingURL=index.js.map