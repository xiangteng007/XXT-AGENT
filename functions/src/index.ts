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

// Set global options for all functions
setGlobalOptions({
    region: 'asia-east1', // Taiwan
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10,
});

/**
 * LINE Webhook Endpoint
 * 
 * This function receives webhook events from LINE and enqueues jobs.
 * Fast ACK design - does not wait for Notion writes.
 * 
 * @example
 * POST https://asia-east1-{project-id}.cloudfunctions.net/lineWebhook
 */
export const lineWebhook = onRequest(
    {
        cors: false, // LINE doesn't need CORS
        invoker: 'public', // Allow public access for LINE webhook
    },
    handleWebhook
);

/**
 * Worker Endpoint (HTTP trigger for testing/manual invocation)
 * 
 * Processes queued jobs and writes to Notion.
 * 
 * @example
 * POST https://asia-east1-{project-id}.cloudfunctions.net/lineWorker
 */
export const lineWorker = onRequest(
    {
        cors: false,
        memory: '512MiB', // Worker may need more memory
        timeoutSeconds: 300, // 5 minutes for batch processing
    },
    handleWorker
);

/**
 * Scheduled Worker
 * 
 * Runs every minute to process queued jobs.
 */
export const lineWorkerScheduled = onSchedule(
    {
        schedule: 'every 1 minutes',
        timeZone: 'Asia/Taipei',
        memory: '512MiB',
        timeoutSeconds: 300,
    },
    async () => {
        const mockReq = { method: 'POST', headers: {} } as any;
        const mockRes = {
            status: () => mockRes,
            json: (data: any) => console.log('[Scheduled Worker]', data),
        } as any;
        await handleWorker(mockReq, mockRes);
    }
);

/**
 * Cleanup Endpoint (HTTP trigger for manual invocation)
 * 
 * Cleans up old jobs, logs, and images.
 * 
 * @example
 * POST https://asia-east1-{project-id}.cloudfunctions.net/lineCleanup
 */
export const lineCleanup = onRequest(
    {
        cors: false,
        memory: '512MiB',
        timeoutSeconds: 540, // 9 minutes
    },
    handleCleanup
);

/**
 * Scheduled Cleanup
 * 
 * Runs daily at 3:00 AM to clean up old data.
 */
export const lineCleanupScheduled = onSchedule(
    {
        schedule: 'every day 03:00',
        timeZone: 'Asia/Taipei',
        memory: '512MiB',
        timeoutSeconds: 540,
    },
    async () => {
        const mockReq = { method: 'POST', headers: {} } as any;
        const mockRes = {
            status: () => mockRes,
            json: (data: any) => console.log('[Scheduled Cleanup]', data),
        } as any;
        await handleCleanup(mockReq, mockRes);
    }
);

// Export handlers for testing
export { handleWebhook, handleWorker, handleCleanup };
