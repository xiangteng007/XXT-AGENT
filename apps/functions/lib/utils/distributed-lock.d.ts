export interface LockOptions {
    /** Lock name (e.g. 'fusion-engine', 'news-collector') */
    name: string;
    /** Maximum lock duration in seconds (auto-release after this) */
    ttlSeconds?: number;
}
/**
 * Acquire a distributed lock. Returns true if lock acquired, false if already held.
 */
export declare function acquireLock(options: LockOptions): Promise<boolean>;
/**
 * Release a distributed lock.
 */
export declare function releaseLock(name: string): Promise<void>;
/**
 * Run a function with a distributed lock.
 * If the lock is already held, the function is skipped silently.
 */
export declare function withLock<T>(options: LockOptions, fn: () => Promise<T>): Promise<T | null>;
//# sourceMappingURL=distributed-lock.d.ts.map