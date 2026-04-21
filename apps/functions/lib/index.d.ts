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
import { handleWebhook } from './handlers/webhook.handler.v2';
import { handleWorker } from './handlers/worker.handler';
import { handleButlerApi } from './handlers/butler-api.handler';
import { handleButlerWebhook } from './handlers/butler-webhook.handler';
import { handleTelegramWebhook } from './handlers/telegram-webhook.handler';
export declare const lineWebhook: import("firebase-functions/https").HttpsFunction;
export declare const butlerWebhook: import("firebase-functions/https").HttpsFunction;
export declare const telegramWebhook: import("firebase-functions/https").HttpsFunction;
export declare const butlerApi: import("firebase-functions/https").HttpsFunction;
export declare const materialCalculatorApi: import("firebase-functions/https").HttpsFunction;
export declare const lineWorker: import("firebase-functions/https").HttpsFunction;
export declare const lineCleanup: import("firebase-functions/https").HttpsFunction;
export declare const newsCollector: import("firebase-functions/https").HttpsFunction;
export declare const reminderManual: import("firebase-functions/https").HttpsFunction;
export { onUserCreated } from './triggers/auth.trigger';
export { handleWebhook, handleWorker, handleButlerApi, handleButlerWebhook, handleTelegramWebhook };
/**
 * Worker Scheduler — processes queued jobs
 */
export declare const lineWorkerScheduled: import("firebase-functions/scheduler").ScheduleFunction;
/**
 * Cleanup Scheduler — daily at 3 AM
 */
export declare const lineCleanupScheduled: import("firebase-functions/scheduler").ScheduleFunction;
/**
 * News Collector — RSS feed aggregation (every 30 min — #16)
 * Dynamic import for cold start optimization (#17)
 */
export declare const newsCollectorScheduled: import("firebase-functions/scheduler").ScheduleFunction;
/**
 * Proactive Reminders — every 30 min (#16)
 */
export declare const reminderScheduled: import("firebase-functions/scheduler").ScheduleFunction;
/**
 * Reminder Cleanup — weekly removal of old notification markers
 */
export declare const reminderCleanup: import("firebase-functions/scheduler").ScheduleFunction;
/**
 * Fusion Engine — cross-domain correlation (every 15 min — #16)
 * Dynamic import for cold start optimization (#17)
 */
export declare const fusionScheduled: import("firebase-functions/scheduler").ScheduleFunction;
/**
 * Market Streamer — TWSE + US stock (every 5 min during trading hours — #16)
 * Dynamic import for cold start optimization (#17)
 */
export declare const marketStreamerScheduled: import("firebase-functions/scheduler").ScheduleFunction;
/**
 * Firestore Scheduled Backup (DE-01)
 */
export { scheduledFirestoreBackup } from './scheduled/backup';
//# sourceMappingURL=index.d.ts.map