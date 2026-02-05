/**
 * Cache Service
 * 
 * Provides caching layer for XXT-AGENT services.
 * Uses in-memory cache with optional Redis upgrade path.
 * 
 * For Firebase Functions (stateless), uses Firestore as persistent cache.
 * For Cloud Run (stateful), can use in-memory with TTL.
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Cache configuration
const CACHE_COLLECTION = '_cache';
const DEFAULT_TTL_SECONDS = 300; // 5 minutes

// In-memory cache for hot data (Cloud Run only)
const memoryCache: Map<string, { value: unknown; expires: number }> = new Map();

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
    value: T;
    createdAt: Timestamp;
    expiresAt: Timestamp;
    hits: number;
}

/**
 * Get cached value
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memEntry = memoryCache.get(key);
    if (memEntry && memEntry.expires > Date.now()) {
        return memEntry.value as T;
    }

    // Check Firestore cache
    try {
        const db = getFirestore();
        const doc = await db.collection(CACHE_COLLECTION).doc(sanitizeKey(key)).get();
        
        if (!doc.exists) {
            return null;
        }

        const data = doc.data() as CacheEntry<T>;
        
        // Check expiration
        if (data.expiresAt.toMillis() < Date.now()) {
            // Expired - delete in background
            doc.ref.delete().catch(() => {});
            return null;
        }

        // Update hit count in background
        doc.ref.update({ hits: data.hits + 1 }).catch(() => {});

        // Store in memory cache for subsequent requests
        memoryCache.set(key, {
            value: data.value,
            expires: data.expiresAt.toMillis(),
        });

        return data.value;
    } catch (error) {
        console.warn('[Cache] Get error:', error);
        return null;
    }
}

/**
 * Set cache value
 */
export async function setInCache<T>(
    key: string, 
    value: T, 
    ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);

    // Store in memory cache
    memoryCache.set(key, { value, expires: expiresAt });

    // Store in Firestore for persistence
    try {
        const db = getFirestore();
        const entry: CacheEntry<T> = {
            value,
            createdAt: Timestamp.fromMillis(now),
            expiresAt: Timestamp.fromMillis(expiresAt),
            hits: 0,
        };

        await db.collection(CACHE_COLLECTION).doc(sanitizeKey(key)).set(entry);
    } catch (error) {
        console.warn('[Cache] Set error:', error);
    }
}

/**
 * Delete cache entry
 */
export async function deleteFromCache(key: string): Promise<void> {
    memoryCache.delete(key);

    try {
        const db = getFirestore();
        await db.collection(CACHE_COLLECTION).doc(sanitizeKey(key)).delete();
    } catch (error) {
        console.warn('[Cache] Delete error:', error);
    }
}

/**
 * Clear cache entries by prefix
 */
export async function clearCacheByPrefix(prefix: string): Promise<number> {
    // Clear memory cache
    let cleared = 0;
    for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
            memoryCache.delete(key);
            cleared++;
        }
    }

    // Clear Firestore cache
    try {
        const db = getFirestore();
        const snapshot = await db.collection(CACHE_COLLECTION)
            .where('__name__', '>=', sanitizeKey(prefix))
            .where('__name__', '<', sanitizeKey(prefix) + '\uf8ff')
            .limit(500)
            .get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            cleared++;
        });
        await batch.commit();
    } catch (error) {
        console.warn('[Cache] Clear by prefix error:', error);
    }

    return cleared;
}

/**
 * Cleanup expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
    const db = getFirestore();
    const now = Timestamp.now();

    try {
        const snapshot = await db.collection(CACHE_COLLECTION)
            .where('expiresAt', '<', now)
            .limit(500)
            .get();

        if (snapshot.empty) {
            return 0;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        console.log(`[Cache] Cleaned up ${snapshot.size} expired entries`);
        return snapshot.size;
    } catch (error) {
        console.warn('[Cache] Cleanup error:', error);
        return 0;
    }
}

/**
 * Cache wrapper for async functions
 */
export function withCache<T>(
    keyFn: (...args: unknown[]) => string,
    fn: (...args: unknown[]) => Promise<T>,
    ttlSeconds: number = DEFAULT_TTL_SECONDS
): (...args: unknown[]) => Promise<T> {
    return async (...args: unknown[]): Promise<T> => {
        const key = keyFn(...args);
        
        // Try cache first
        const cached = await getFromCache<T>(key);
        if (cached !== null) {
            return cached;
        }

        // Execute function
        const result = await fn(...args);

        // Store in cache
        await setInCache(key, result, ttlSeconds);

        return result;
    };
}

/**
 * Sanitize key for Firestore document ID
 */
function sanitizeKey(key: string): string {
    return key.replace(/[/.#$[\]]/g, '_').substring(0, 500);
}

/**
 * Cache statistics
 */
export function getCacheStats(): { memorySize: number; keys: string[] } {
    return {
        memorySize: memoryCache.size,
        keys: Array.from(memoryCache.keys()),
    };
}
