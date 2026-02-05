/**
 * LINE to Notion Multi-Tenant Platform
 * Firebase Cloud Functions Entry Point
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { handleWebhook } from './handlers/webhook.handler.v2';
import { handleWorker } from './handlers/worker.handler';
import { handleCleanup } from './handlers/cleanup.handler';
import { handleButlerApi } from './handlers/butler-api.handler';
import { handleButlerWebhook } from './handlers/butler-webhook.handler';

// Set global options for all functions
setGlobalOptions({
    region: 'asia-east1', // Taiwan
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10,
});

// Type assertion helper for cross-library type compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = any;

/**
 * LINE Webhook Endpoint
 */
export const lineWebhook = onRequest(
    {
        cors: false,
        invoker: 'public',
    },
    handleWebhook as AnyHandler
);

/**
 * Worker Endpoint
 */
export const lineWorker = onRequest(
    {
        cors: false,
        memory: '512MiB',
        timeoutSeconds: 300,
    },
    handleWorker as AnyHandler
);

/**
 * Scheduled Worker
 */
export const lineWorkerScheduled = onSchedule(
    {
        schedule: 'every 1 minutes',
        timeZone: 'Asia/Taipei',
        memory: '512MiB',
        timeoutSeconds: 300,
    },
    async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockReq = { method: 'POST', headers: {} } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockRes = {
            status: () => mockRes,
            json: (data: unknown) => console.log('[Scheduled Worker]', data),
        } as any;
        await handleWorker(mockReq, mockRes);
    }
);

/**
 * Cleanup Endpoint
 */
export const lineCleanup = onRequest(
    {
        cors: false,
        memory: '512MiB',
        timeoutSeconds: 540,
    },
    handleCleanup as AnyHandler
);

/**
 * Scheduled Cleanup
 */
export const lineCleanupScheduled = onSchedule(
    {
        schedule: 'every day 03:00',
        timeZone: 'Asia/Taipei',
        memory: '512MiB',
        timeoutSeconds: 540,
    },
    async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockReq = { method: 'POST', headers: {} } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockRes = {
            status: () => mockRes,
            json: (data: unknown) => console.log('[Scheduled Cleanup]', data),
        } as any;
        await handleCleanup(mockReq, mockRes);
    }
);

/**
 * Butler API Endpoint
 */
export const butlerApi = onRequest(
    {
        cors: true,
        memory: '512MiB',
        timeoutSeconds: 60,
    },
    handleButlerApi as AnyHandler
);

/**
 * Butler LINE Webhook Endpoint
 */
export const butlerWebhook = onRequest(
    {
        cors: false,
        invoker: 'public',
        memory: '256MiB',
    },
    handleButlerWebhook as AnyHandler
);

/**
 * Telegram Bot Webhook Endpoint
 * Handles incoming updates from Telegram Bot API
 */
import { handleTelegramWebhook } from './handlers/telegram-webhook.handler';

export const telegramWebhook = onRequest(
    {
        cors: false,
        invoker: 'public',
        memory: '256MiB',
        timeoutSeconds: 30,
    },
    handleTelegramWebhook as AnyHandler
);

// Export handlers for testing
export { handleWebhook, handleWorker, handleCleanup, handleButlerApi, handleButlerWebhook, handleTelegramWebhook };

// Auth triggers - temporarily disabled until Firebase Auth is enabled in project
// To re-enable: uncomment and ensure Firebase Auth is enabled in the GCP project
// export { onUserCreated } from './triggers/auth.trigger';

