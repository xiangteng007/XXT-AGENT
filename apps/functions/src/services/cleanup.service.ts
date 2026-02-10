/**
 * Cleanup Service - Automated maintenance tasks
 * 
 * - Delete completed/ignored jobs older than retention period
 * - Delete old logs
 * - Clean up orphaned images
 */
import { logger } from 'firebase-functions/v2';
import { getDb } from '../config/firebase';
import { deleteOldImages } from './storage.service';

const JOBS_RETENTION_DAYS = 7;       // Keep completed jobs for 7 days
const DEAD_JOBS_RETENTION_DAYS = 30; // Keep dead jobs longer for debugging
const LOGS_RETENTION_DAYS = 30;      // Keep logs for 30 days
const IMAGES_RETENTION_DAYS = 90;    // Keep images for 90 days

/**
 * Clean up old completed/ignored jobs
 */
export async function cleanupOldJobs(): Promise<{ deleted: number; errors: number }> {
    const db = getDb();
    const now = new Date();

    // Calculate cutoff dates
    const completedCutoff = new Date(now);
    completedCutoff.setDate(completedCutoff.getDate() - JOBS_RETENTION_DAYS);

    const deadCutoff = new Date(now);
    deadCutoff.setDate(deadCutoff.getDate() - DEAD_JOBS_RETENTION_DAYS);

    let deleted = 0;
    let errors = 0;

    try {
        // Delete old completed/ignored jobs
        const completedSnapshot = await db.collection('jobs')
            .where('status', 'in', ['done', 'ignored'])
            .where('updatedAt', '<', completedCutoff)
            .limit(500) // Batch limit
            .get();

        for (const doc of completedSnapshot.docs) {
            try {
                await doc.ref.delete();
                deleted++;
            } catch {
                errors++;
            }
        }

        // Delete old dead jobs (longer retention)
        const deadSnapshot = await db.collection('jobs')
            .where('status', '==', 'dead')
            .where('updatedAt', '<', deadCutoff)
            .limit(200)
            .get();

        for (const doc of deadSnapshot.docs) {
            try {
                await doc.ref.delete();
                deleted++;
            } catch {
                errors++;
            }
        }

        logger.info(`[Cleanup] Jobs: deleted ${deleted}, errors ${errors}`);

    } catch (error) {
        logger.error('[Cleanup] Jobs cleanup error:', error);
        errors++;
    }

    return { deleted, errors };
}

/**
 * Clean up old logs
 */
export async function cleanupOldLogs(): Promise<{ deleted: number; errors: number }> {
    const db = getDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - LOGS_RETENTION_DAYS);

    let deleted = 0;
    let errors = 0;

    try {
        const snapshot = await db.collection('logs')
            .where('timestamp', '<', cutoff)
            .limit(500)
            .get();

        for (const doc of snapshot.docs) {
            try {
                await doc.ref.delete();
                deleted++;
            } catch {
                errors++;
            }
        }

        logger.info(`[Cleanup] Logs: deleted ${deleted}, errors ${errors}`);

    } catch (error) {
        logger.error('[Cleanup] Logs cleanup error:', error);
        errors++;
    }

    return { deleted, errors };
}

/**
 * Clean up old processed events (deduplication records)
 */
export async function cleanupProcessedEvents(): Promise<{ deleted: number; errors: number }> {
    const db = getDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7); // Keep for 7 days

    let deleted = 0;
    let errors = 0;

    try {
        const snapshot = await db.collection('processedEvents')
            .where('processedAt', '<', cutoff)
            .limit(500)
            .get();

        for (const doc of snapshot.docs) {
            try {
                await doc.ref.delete();
                deleted++;
            } catch {
                errors++;
            }
        }

        logger.info(`[Cleanup] ProcessedEvents: deleted ${deleted}, errors ${errors}`);

    } catch (error) {
        logger.error('[Cleanup] ProcessedEvents cleanup error:', error);
        errors++;
    }

    return { deleted, errors };
}

/**
 * Clean up old images in Cloud Storage
 */
export async function cleanupOldImages(tenantIds: string[]): Promise<{ totalDeleted: number }> {
    let totalDeleted = 0;

    for (const tenantId of tenantIds) {
        try {
            const deleted = await deleteOldImages(tenantId, IMAGES_RETENTION_DAYS);
            totalDeleted += deleted;
        } catch (error) {
            logger.error(`[Cleanup] Images cleanup error for ${tenantId}:`, error);
        }
    }

    logger.info(`[Cleanup] Images: deleted ${totalDeleted} total`);
    return { totalDeleted };
}

/**
 * Get all tenant IDs for cleanup
 */
export async function getAllTenantIds(): Promise<string[]> {
    const db = getDb();

    try {
        const snapshot = await db.collection('tenants').select().get();
        return snapshot.docs.map(doc => doc.id);
    } catch (error) {
        logger.error('[Cleanup] Failed to get tenant IDs:', error);
        return [];
    }
}

/**
 * Run all cleanup tasks
 */
export async function runAllCleanup(): Promise<{
    jobs: { deleted: number; errors: number };
    logs: { deleted: number; errors: number };
    events: { deleted: number; errors: number };
    images: { totalDeleted: number };
}> {
    logger.info('[Cleanup] Starting scheduled cleanup...');

    const [jobs, logs, events] = await Promise.all([
        cleanupOldJobs(),
        cleanupOldLogs(),
        cleanupProcessedEvents(),
    ]);

    // Get tenant IDs for image cleanup
    const tenantIds = await getAllTenantIds();
    const images = await cleanupOldImages(tenantIds);

    logger.info('[Cleanup] Completed:', { jobs, logs, events, images });

    return { jobs, logs, events, images };
}
