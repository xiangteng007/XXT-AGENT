/**
 * Cache Service
 *
 * Provides caching layer for XXT-AGENT services.
 * Uses in-memory cache with optional Redis upgrade path.
 *
 * For Firebase Functions (stateless), uses Firestore as persistent cache.
 * For Cloud Run (stateful), can use in-memory with TTL.
 */
/**
 * Get cached value
 */
export declare function getFromCache<T>(key: string): Promise<T | null>;
/**
 * Set cache value
 */
export declare function setInCache<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
/**
 * Delete cache entry
 */
export declare function deleteFromCache(key: string): Promise<void>;
/**
 * Clear cache entries by prefix
 */
export declare function clearCacheByPrefix(prefix: string): Promise<number>;
/**
 * Cleanup expired cache entries
 */
export declare function cleanupExpiredCache(): Promise<number>;
/**
 * Cache wrapper for async functions
 */
export declare function withCache<T>(keyFn: (...args: unknown[]) => string, fn: (...args: unknown[]) => Promise<T>, ttlSeconds?: number): (...args: unknown[]) => Promise<T>;
/**
 * Cache statistics
 */
export declare function getCacheStats(): {
    memorySize: number;
    keys: string[];
};
//# sourceMappingURL=cache.service.d.ts.map