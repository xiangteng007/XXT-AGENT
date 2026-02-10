/**
 * Distributed Lock (#10)
 * 
 * Firestore-based distributed lock to prevent concurrent 
 * execution of scheduled functions across multiple Cloud Function instances.
 * 
 * Uses atomic Firestore transactions with TTL-based auto-release.
 */
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();
const LOCKS_COLLECTION = '_schedulerLocks';

export interface LockOptions {
    /** Lock name (e.g. 'fusion-engine', 'news-collector') */
    name: string;
    /** Maximum lock duration in seconds (auto-release after this) */
    ttlSeconds?: number;
}

/**
 * Acquire a distributed lock. Returns true if lock acquired, false if already held.
 */
export async function acquireLock(options: LockOptions): Promise<boolean> {
    const { name, ttlSeconds = 300 } = options;
    const lockRef = db.collection(LOCKS_COLLECTION).doc(name);
    
    try {
        const result = await db.runTransaction(async (tx) => {
            const doc = await tx.get(lockRef);
            
            if (doc.exists) {
                const data = doc.data();
                const lockedAt = data?.lockedAt as Timestamp;
                const now = Timestamp.now();
                const ageSeconds = now.seconds - lockedAt.seconds;
                
                // Check if lock has expired (auto-release)
                if (ageSeconds < (data?.ttlSeconds || ttlSeconds)) {
                    return false; // Lock still held by another instance
                }
                // Lock expired — take over
            }
            
            tx.set(lockRef, {
                lockedAt: FieldValue.serverTimestamp(),
                ttlSeconds,
                instanceId: process.env.K_REVISION || 'unknown',
                updatedAt: FieldValue.serverTimestamp(),
            });
            
            return true;
        });
        
        return result;
    } catch (error) {
        logger.error(`[Lock] Failed to acquire lock "${name}":`, error);
        return false;
    }
}

/**
 * Release a distributed lock.
 */
export async function releaseLock(name: string): Promise<void> {
    try {
        await db.collection(LOCKS_COLLECTION).doc(name).delete();
    } catch (error) {
        logger.error(`[Lock] Failed to release lock "${name}":`, error);
    }
}

/**
 * Run a function with a distributed lock.
 * If the lock is already held, the function is skipped silently.
 */
export async function withLock<T>(
    options: LockOptions,
    fn: () => Promise<T>
): Promise<T | null> {
    const acquired = await acquireLock(options);
    if (!acquired) {
        logger.info(`[Lock] Skipping "${options.name}" — already running`);
        return null;
    }
    
    try {
        return await fn();
    } finally {
        await releaseLock(options.name);
    }
}
