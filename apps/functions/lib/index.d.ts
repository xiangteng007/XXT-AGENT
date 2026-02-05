/**
 * LINE to Notion Multi-Tenant Platform
 * Firebase Cloud Functions Entry Point
 */
import { handleWebhook } from './handlers/webhook.handler.v2';
import { handleWorker } from './handlers/worker.handler';
import { handleCleanup } from './handlers/cleanup.handler';
import { handleButlerApi } from './handlers/butler-api.handler';
import { handleButlerWebhook } from './handlers/butler-webhook.handler';
/**
 * LINE Webhook Endpoint
 */
export declare const lineWebhook: import("firebase-functions/v2/https").HttpsFunction;
/**
 * Worker Endpoint
 */
export declare const lineWorker: import("firebase-functions/v2/https").HttpsFunction;
/**
 * Scheduled Worker
 */
export declare const lineWorkerScheduled: import("firebase-functions/v2/scheduler").ScheduleFunction;
/**
 * Cleanup Endpoint
 */
export declare const lineCleanup: import("firebase-functions/v2/https").HttpsFunction;
/**
 * Scheduled Cleanup
 */
export declare const lineCleanupScheduled: import("firebase-functions/v2/scheduler").ScheduleFunction;
/**
 * Butler API Endpoint
 */
export declare const butlerApi: import("firebase-functions/v2/https").HttpsFunction;
/**
 * Butler LINE Webhook Endpoint
 */
export declare const butlerWebhook: import("firebase-functions/v2/https").HttpsFunction;
/**
 * Telegram Bot Webhook Endpoint
 * Handles incoming updates from Telegram Bot API
 */
import { handleTelegramWebhook } from './handlers/telegram-webhook.handler';
export declare const telegramWebhook: import("firebase-functions/v2/https").HttpsFunction;
export { handleWebhook, handleWorker, handleCleanup, handleButlerApi, handleButlerWebhook, handleTelegramWebhook };
//# sourceMappingURL=index.d.ts.map