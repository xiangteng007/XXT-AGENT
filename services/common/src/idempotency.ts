/**
 * Idempotency Store
 * 
 * Prevents duplicate event processing using hash-based deduplication.
 * Supports both in-memory (dev) and Firestore (production) backends.
 */

import { createHash } from 'crypto';

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
export function generateIdempotencyKey(
    source: string,
    symbol: string | undefined,
    timestamp: string,
    type: string,
    additionalData?: string
): string {
    const data = [source, symbol || '', timestamp, type, additionalData || ''].join(':');
    return createHash('sha256').update(data).digest('hex').substring(0, 32);
}

// ============ In-Memory Store (Development) ============

interface MemoryEntry {
    key: string;
    expiresAt: number;
}

class InMemoryIdempotencyStore implements IdempotencyStore {
    private store = new Map<string, MemoryEntry>();
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(cleanupIntervalMs = 60000) {
        // Periodic cleanup every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    }

    async exists(key: string): Promise<boolean> {
        const entry = this.store.get(key);
        if (!entry) return false;

        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return false;
        }

        return true;
    }

    async set(key: string, ttlSeconds = 86400): Promise<void> {
        this.store.set(key, {
            key,
            expiresAt: Date.now() + (ttlSeconds * 1000)
        });
    }

    async delete(key: string): Promise<void> {
        this.store.delete(key);
    }

    async cleanup(): Promise<void> {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

// ============ Firestore Store (Production) ============

interface FirestoreClient {
    collection(path: string): {
        doc(id: string): {
            get(): Promise<{ exists: boolean; data(): unknown }>;
            set(data: unknown): Promise<void>;
            delete(): Promise<void>;
        };
    };
}

class FirestoreIdempotencyStore implements IdempotencyStore {
    private db: FirestoreClient;
    private collection: string;

    constructor(db: FirestoreClient, collection = 'idempotency_keys') {
        this.db = db;
        this.collection = collection;
    }

    async exists(key: string): Promise<boolean> {
        const doc = await this.db.collection(this.collection).doc(key).get();

        if (!doc.exists) return false;

        const data = doc.data() as { expiresAt: { toMillis(): number } } | undefined;
        if (!data) return false;

        // Check expiration
        const expiresAt = data.expiresAt?.toMillis?.() ?? 0;
        if (Date.now() > expiresAt) {
            // Expired, clean up
            await this.delete(key);
            return false;
        }

        return true;
    }

    async set(key: string, ttlSeconds = 86400): Promise<void> {
        const expiresAt = new Date(Date.now() + (ttlSeconds * 1000));

        await this.db.collection(this.collection).doc(key).set({
            key,
            expiresAt,
            createdAt: new Date()
        });
    }

    async delete(key: string): Promise<void> {
        await this.db.collection(this.collection).doc(key).delete();
    }
}

// ============ Factory ============

let idempotencyStoreInstance: IdempotencyStore | null = null;

export function createIdempotencyStore(
    type: 'memory' | 'firestore' = 'memory',
    firestoreDb?: FirestoreClient
): IdempotencyStore {
    if (type === 'firestore' && firestoreDb) {
        return new FirestoreIdempotencyStore(firestoreDb);
    }
    return new InMemoryIdempotencyStore();
}

export function getIdempotencyStore(): IdempotencyStore {
    if (!idempotencyStoreInstance) {
        idempotencyStoreInstance = createIdempotencyStore('memory');
    }
    return idempotencyStoreInstance;
}

export function setIdempotencyStore(store: IdempotencyStore): void {
    idempotencyStoreInstance = store;
}

// ============ Decorator / Wrapper ============

export interface IdempotentProcessorOptions {
    store?: IdempotencyStore;
    keyGenerator?: (event: unknown) => string;
    ttlSeconds?: number;
    onDuplicate?: (key: string, event: unknown) => void;
}

/**
 * Wrap an event processor with idempotency checking
 */
export function withIdempotency<T, R>(
    processor: (event: T) => Promise<R>,
    options: IdempotentProcessorOptions = {}
): (event: T) => Promise<R | null> {
    const {
        store = getIdempotencyStore(),
        keyGenerator = (e) => JSON.stringify(e),
        ttlSeconds = 86400,
        onDuplicate
    } = options;

    return async (event: T): Promise<R | null> => {
        const key = createHash('sha256').update(keyGenerator(event)).digest('hex').substring(0, 32);

        // Check if already processed
        if (await store.exists(key)) {
            onDuplicate?.(key, event);
            console.log(JSON.stringify({
                severity: 'INFO',
                message: 'Skipping duplicate event',
                idempotencyKey: key
            }));
            return null;
        }

        // Process the event
        const result = await processor(event);

        // Mark as processed
        await store.set(key, ttlSeconds);

        return result;
    };
}
