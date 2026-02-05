"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueJob = enqueueJob;
exports.fetchQueuedJobs = fetchQueuedJobs;
exports.claimJob = claimJob;
exports.completeJob = completeJob;
exports.failJob = failJob;
exports.isEventProcessed = isEventProcessed;
exports.markEventProcessed = markEventProcessed;
exports.getJob = getJob;
exports.updateJobStatus = updateJobStatus;
/**
 * Queue Service - Manages job queue in Firestore
 *
 * Design: Firestore-based queue (no Cloud Tasks dependency for MVP)
 * - Jobs stored in /jobs collection
 * - Worker polls for queued jobs
 * - Supports retry with exponential backoff
 */
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
const JOBS_COLLECTION = 'jobs';
const MAX_ATTEMPTS = 5;
/**
 * Enqueue a new job
 */
async function enqueueJob(payload, webhookEventId) {
    const db = (0, firebase_1.getDb)();
    const jobData = {
        tenantId: payload.tenantId,
        status: 'queued',
        attempts: 0,
        maxAttempts: MAX_ATTEMPTS,
        webhookEventId,
        eventType: payload.messageType,
        payload,
        ruleId: payload.ruleId,
        databaseId: payload.databaseId,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    const docRef = await db.collection(JOBS_COLLECTION).add(jobData);
    console.log(`[Queue] Job enqueued: ${docRef.id} for tenant ${payload.tenantId}`);
    return docRef.id;
}
/**
 * Fetch queued jobs for processing
 */
async function fetchQueuedJobs(limit = 10) {
    const db = (0, firebase_1.getDb)();
    const snapshot = await db.collection(JOBS_COLLECTION)
        .where('status', '==', 'queued')
        .orderBy('createdAt', 'asc')
        .limit(limit)
        .get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    }));
}
/**
 * Claim a job for processing (atomic update)
 */
async function claimJob(jobId) {
    const db = (0, firebase_1.getDb)();
    const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(jobRef);
            if (!doc.exists)
                throw new Error('Job not found');
            const data = doc.data();
            if (data?.status !== 'queued') {
                throw new Error('Job already claimed');
            }
            transaction.update(jobRef, {
                status: 'processing',
                attempts: firestore_1.FieldValue.increment(1),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        });
        return true;
    }
    catch (error) {
        console.warn(`[Queue] Failed to claim job ${jobId}:`, error);
        return false;
    }
}
/**
 * Mark job as completed
 */
async function completeJob(jobId) {
    const db = (0, firebase_1.getDb)();
    await db.collection(JOBS_COLLECTION).doc(jobId).update({
        status: 'done',
        processedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    console.log(`[Queue] Job completed: ${jobId}`);
}
/**
 * Mark job as failed (may retry or dead)
 */
async function failJob(jobId, error) {
    const db = (0, firebase_1.getDb)();
    const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
    const doc = await jobRef.get();
    if (!doc.exists)
        return;
    const data = doc.data();
    const attempts = data.attempts || 1;
    const maxAttempts = data.maxAttempts || MAX_ATTEMPTS;
    // If max attempts reached, mark as dead
    const newStatus = attempts >= maxAttempts ? 'dead' : 'failed';
    // For failed (not dead), set back to queued for retry
    const statusToSet = newStatus === 'dead' ? 'dead' : 'queued';
    await jobRef.update({
        status: statusToSet,
        lastError: {
            code: error.name || 'UNKNOWN',
            message: error.message?.substring(0, 500) || 'Unknown error',
            timestamp: firestore_1.Timestamp.now(),
        },
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    console.log(`[Queue] Job ${newStatus === 'dead' ? 'dead' : 'will retry'}: ${jobId} (attempt ${attempts}/${maxAttempts})`);
}
/**
 * Check if event already processed (deduplication)
 */
async function isEventProcessed(webhookEventId) {
    const db = (0, firebase_1.getDb)();
    // Check processedEvents collection
    const doc = await db.collection('processedEvents').doc(webhookEventId).get();
    return doc.exists;
}
/**
 * Mark event as processed (deduplication)
 */
async function markEventProcessed(webhookEventId, tenantId) {
    const db = (0, firebase_1.getDb)();
    await db.collection('processedEvents').doc(webhookEventId).set({
        tenantId,
        processedAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
/**
 * Get job by ID
 */
async function getJob(jobId) {
    const db = (0, firebase_1.getDb)();
    const doc = await db.collection(JOBS_COLLECTION).doc(jobId).get();
    if (!doc.exists)
        return null;
    return {
        id: doc.id,
        ...doc.data(),
    };
}
/**
 * Update job status (for dashboard requeue/ignore)
 */
async function updateJobStatus(jobId, status, actorUid) {
    const db = (0, firebase_1.getDb)();
    const updateData = {
        status,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (status === 'queued' && actorUid) {
        updateData.requeuedAt = firestore_1.FieldValue.serverTimestamp();
        updateData.requeuedBy = actorUid;
        updateData.attempts = 0; // Reset attempts on requeue
    }
    if (status === 'ignored' && actorUid) {
        updateData.ignoredAt = firestore_1.FieldValue.serverTimestamp();
        updateData.ignoredBy = actorUid;
    }
    await db.collection(JOBS_COLLECTION).doc(jobId).update(updateData);
}
//# sourceMappingURL=queue.service.js.map