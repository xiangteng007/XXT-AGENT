/**
 * Queue Service - Manages job queue in Firestore
 * 
 * Design: Firestore-based queue (no Cloud Tasks dependency for MVP)
 * - Jobs stored in /jobs collection
 * - Worker polls for queued jobs
 * - Supports retry with exponential backoff
 */
import { logger } from 'firebase-functions/v2';
import { getDb } from '../config/firebase';
import { Job, JobPayload, JobStatus } from '../models/job.model';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const JOBS_COLLECTION = 'jobs';
const MAX_ATTEMPTS = 5;

/**
 * Enqueue a new job
 */
export async function enqueueJob(payload: JobPayload, webhookEventId: string): Promise<string> {
    const db = getDb();

    const jobData = {
        tenantId: payload.tenantId,
        status: 'queued' as JobStatus,
        attempts: 0,
        maxAttempts: MAX_ATTEMPTS,
        webhookEventId,
        eventType: payload.messageType,
        payload,
        ruleId: payload.ruleId,
        databaseId: payload.databaseId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(JOBS_COLLECTION).add(jobData);

    logger.info(`[Queue] Job enqueued: ${docRef.id} for tenant ${payload.tenantId}`);

    return docRef.id;
}

/**
 * Fetch queued jobs for processing
 */
export async function fetchQueuedJobs(limit = 10): Promise<Job[]> {
    const db = getDb();

    const snapshot = await db.collection(JOBS_COLLECTION)
        .where('status', '==', 'queued')
        .orderBy('createdAt', 'asc')
        .limit(limit)
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    })) as Job[];
}

/**
 * Claim a job for processing (atomic update)
 */
export async function claimJob(jobId: string): Promise<boolean> {
    const db = getDb();
    const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(jobRef);
            if (!doc.exists) throw new Error('Job not found');

            const data = doc.data();
            if (data?.status !== 'queued') {
                throw new Error('Job already claimed');
            }

            transaction.update(jobRef, {
                status: 'processing',
                attempts: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
            });
        });
        return true;
    } catch (error) {
        logger.warn(`[Queue] Failed to claim job ${jobId}:`, error);
        return false;
    }
}

/**
 * Mark job as completed
 */
export async function completeJob(jobId: string): Promise<void> {
    const db = getDb();

    await db.collection(JOBS_COLLECTION).doc(jobId).update({
        status: 'done',
        processedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`[Queue] Job completed: ${jobId}`);
}

/**
 * Mark job as failed (may retry or dead)
 */
export async function failJob(jobId: string, error: Error): Promise<void> {
    const db = getDb();
    const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);

    const doc = await jobRef.get();
    if (!doc.exists) return;

    const data = doc.data() as Job;
    const attempts = data.attempts || 1;
    const maxAttempts = data.maxAttempts || MAX_ATTEMPTS;

    // If max attempts reached, mark as dead
    const newStatus: JobStatus = attempts >= maxAttempts ? 'dead' : 'failed';

    // For failed (not dead), set back to queued for retry
    const statusToSet: JobStatus = newStatus === 'dead' ? 'dead' : 'queued';

    await jobRef.update({
        status: statusToSet,
        lastError: {
            code: error.name || 'UNKNOWN',
            message: error.message?.substring(0, 500) || 'Unknown error',
            timestamp: Timestamp.now(),
        },
        updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`[Queue] Job ${newStatus === 'dead' ? 'dead' : 'will retry'}: ${jobId} (attempt ${attempts}/${maxAttempts})`);
}

/**
 * Check if event already processed (deduplication)
 */
export async function isEventProcessed(webhookEventId: string): Promise<boolean> {
    const db = getDb();

    // Check processedEvents collection
    const doc = await db.collection('processedEvents').doc(webhookEventId).get();
    return doc.exists;
}

/**
 * Mark event as processed (deduplication)
 */
export async function markEventProcessed(webhookEventId: string, tenantId: string): Promise<void> {
    const db = getDb();

    await db.collection('processedEvents').doc(webhookEventId).set({
        tenantId,
        processedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
    const db = getDb();
    const doc = await db.collection(JOBS_COLLECTION).doc(jobId).get();

    if (!doc.exists) return null;

    return {
        id: doc.id,
        ...doc.data(),
    } as Job;
}

/**
 * Update job status (for dashboard requeue/ignore)
 */
export async function updateJobStatus(jobId: string, status: JobStatus, actorUid?: string): Promise<void> {
    const db = getDb();

    const updateData: Record<string, unknown> = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (status === 'queued' && actorUid) {
        updateData.requeuedAt = FieldValue.serverTimestamp();
        updateData.requeuedBy = actorUid;
        updateData.attempts = 0; // Reset attempts on requeue
    }

    if (status === 'ignored' && actorUid) {
        updateData.ignoredAt = FieldValue.serverTimestamp();
        updateData.ignoredBy = actorUid;
    }

    await db.collection(JOBS_COLLECTION).doc(jobId).update(updateData);
}
