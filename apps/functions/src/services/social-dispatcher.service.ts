/**
 * Social Dispatcher Service
 * 
 * Triggered by Cloud Scheduler every minute.
 * Reads enabled social_sources and fans out Cloud Tasks for each source.
 */

import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { CloudTasksClient } from '@google-cloud/tasks';
import { SocialSource, CollectJob } from '../types/social.types';
import { getErrorMessage } from '../utils/error-handling';

const db = admin.firestore();
const tasksClient = new CloudTasksClient();

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
const LOCATION = process.env.FUNCTION_REGION || 'asia-east1';
const QUEUE_NAME = 'social-collect-queue';
const COLLECTOR_URL = process.env.SOCIAL_COLLECTOR_URL || '';

/**
 * Main dispatcher function
 */
export async function dispatchSocialCollectJobs(): Promise<{
    dispatched: number;
    skipped: number;
    errors: string[];
}> {
    logger.info('[Social Dispatcher] Starting dispatch cycle...');

    const result = { dispatched: 0, skipped: 0, errors: [] as string[] };

    try {
        // Fetch all enabled sources across all tenants
        const sourcesSnapshot = await db.collectionGroup('sources')
            .where('enabled', '==', true)
            .get();

        logger.info(`[Social Dispatcher] Found ${sourcesSnapshot.size} enabled sources`);

        for (const doc of sourcesSnapshot.docs) {
            const source = { id: doc.id, ...doc.data() } as SocialSource;

            // Skip if webhook mode (handled by webhook endpoint)
            if (source.mode === 'webhook') {
                result.skipped++;
                continue;
            }

            try {
                await createCollectTask(source);
                result.dispatched++;
            } catch (err: unknown) {
                logger.error(`[Social Dispatcher] Failed to create task for ${source.id}:`, err);
                result.errors.push(`${source.id}: ${getErrorMessage(err)}`);
            }
        }

        logger.info('[Social Dispatcher] Dispatch complete:', result);
        return result;

    } catch (err: unknown) {
        logger.error('[Social Dispatcher] Fatal error:', err);
        result.errors.push(getErrorMessage(err));
        return result;
    }
}

/**
 * Create a Cloud Task for collecting from a source
 */
async function createCollectTask(source: SocialSource): Promise<void> {
    const parent = tasksClient.queuePath(PROJECT_ID, LOCATION, QUEUE_NAME);

    const job: CollectJob = {
        tenantId: source.tenantId,
        sourceId: source.id,
        platform: source.platform,
        priority: 'normal',
        retryCount: 0,
        createdAt: new Date(),
    };

    const task = {
        httpRequest: {
            httpMethod: 'POST' as const,
            url: COLLECTOR_URL,
            headers: {
                'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(job)).toString('base64'),
            oidcToken: {
                serviceAccountEmail: process.env.SERVICE_ACCOUNT_EMAIL || '',
            },
        },
        scheduleTime: {
            seconds: Math.floor(Date.now() / 1000),
        },
    };

    await tasksClient.createTask({ parent, task });
    logger.info(`[Social Dispatcher] Created task for ${source.platform}:${source.id}`);
}

/**
 * Get all tenant IDs that have social sources
 */
export async function getTenantsWithSources(): Promise<string[]> {
    const tenantsSnapshot = await db.collection('social_sources').listDocuments();
    return tenantsSnapshot.map(doc => doc.id);
}
