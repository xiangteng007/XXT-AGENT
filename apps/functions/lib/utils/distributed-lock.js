"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireLock = acquireLock;
exports.releaseLock = releaseLock;
exports.withLock = withLock;
/**
 * Distributed Lock (#10)
 *
 * Firestore-based distributed lock to prevent concurrent
 * execution of scheduled functions across multiple Cloud Function instances.
 *
 * Uses atomic Firestore transactions with TTL-based auto-release.
 */
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
const LOCKS_COLLECTION = '_schedulerLocks';
/**
 * Acquire a distributed lock. Returns true if lock acquired, false if already held.
 */
async function acquireLock(options) {
    const { name, ttlSeconds = 300 } = options;
    const lockRef = db.collection(LOCKS_COLLECTION).doc(name);
    try {
        const result = await db.runTransaction(async (tx) => {
            const doc = await tx.get(lockRef);
            if (doc.exists) {
                const data = doc.data();
                const lockedAt = data?.lockedAt;
                const now = firestore_1.Timestamp.now();
                const ageSeconds = now.seconds - lockedAt.seconds;
                // Check if lock has expired (auto-release)
                if (ageSeconds < (data?.ttlSeconds || ttlSeconds)) {
                    return false; // Lock still held by another instance
                }
                // Lock expired — take over
            }
            tx.set(lockRef, {
                lockedAt: firestore_1.FieldValue.serverTimestamp(),
                ttlSeconds,
                instanceId: process.env.K_REVISION || 'unknown',
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            return true;
        });
        return result;
    }
    catch (error) {
        v2_1.logger.error(`[Lock] Failed to acquire lock "${name}":`, error);
        return false;
    }
}
/**
 * Release a distributed lock.
 */
async function releaseLock(name) {
    try {
        await db.collection(LOCKS_COLLECTION).doc(name).delete();
    }
    catch (error) {
        v2_1.logger.error(`[Lock] Failed to release lock "${name}":`, error);
    }
}
/**
 * Run a function with a distributed lock.
 * If the lock is already held, the function is skipped silently.
 */
async function withLock(options, fn) {
    const acquired = await acquireLock(options);
    if (!acquired) {
        v2_1.logger.info(`[Lock] Skipping "${options.name}" — already running`);
        return null;
    }
    try {
        return await fn();
    }
    finally {
        await releaseLock(options.name);
    }
}
//# sourceMappingURL=distributed-lock.js.map