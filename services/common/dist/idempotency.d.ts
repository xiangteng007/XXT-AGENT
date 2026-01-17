/**
 * Idempotency Store
 *
 * Prevents duplicate event processing using hash-based deduplication.
 * Supports both in-memory (dev) and Firestore (production) backends.
 */
export interface IdempotencyStore {
    /**
     * Check if event has been processed
     * @returns true if already processed (duplicate)
     */
    exists(key: string): Promise<boolean>;
    /**
     * Mark event as processed
     * @param key Event idempotency key
     * @param ttlSeconds Time-to-live in seconds (default: 24 hours)
     */
    set(key: string, ttlSeconds?: number): Promise<void>;
    /**
     * Remove processed mark (for replay)
     */
    delete(key: string): Promise<void>;
    /**
     * Clean up expired entries (for in-memory store)
     */
    cleanup?(): Promise<void>;
}
/**
 * Generate idempotency key from event data
 */
export declare function generateIdempotencyKey(source: string, symbol: string | undefined, timestamp: string, type: string, additionalData?: string): string;
interface FirestoreClient {
    collection(path: string): {
        doc(id: string): {
            get(): Promise<{
                exists: boolean;
                data(): unknown;
            }>;
            set(data: unknown): Promise<void>;
            delete(): Promise<void>;
        };
    };
}
export declare function createIdempotencyStore(type?: 'memory' | 'firestore', firestoreDb?: FirestoreClient): IdempotencyStore;
export declare function getIdempotencyStore(): IdempotencyStore;
export declare function setIdempotencyStore(store: IdempotencyStore): void;
export interface IdempotentProcessorOptions {
    store?: IdempotencyStore;
    keyGenerator?: (event: unknown) => string;
    ttlSeconds?: number;
    onDuplicate?: (key: string, event: unknown) => void;
}
/**
 * Wrap an event processor with idempotency checking
 */
export declare function withIdempotency<T, R>(processor: (event: T) => Promise<R>, options?: IdempotentProcessorOptions): (event: T) => Promise<R | null>;
export {};
