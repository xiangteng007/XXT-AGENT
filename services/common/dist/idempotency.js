"use strict";
/**
 * Idempotency Store
 *
 * Prevents duplicate event processing using hash-based deduplication.
 * Supports both in-memory (dev) and Firestore (production) backends.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateIdempotencyKey = generateIdempotencyKey;
exports.createIdempotencyStore = createIdempotencyStore;
exports.getIdempotencyStore = getIdempotencyStore;
exports.setIdempotencyStore = setIdempotencyStore;
exports.withIdempotency = withIdempotency;
const crypto_1 = require("crypto");
/**
 * Generate idempotency key from event data
 */
function generateIdempotencyKey(source, symbol, timestamp, type, additionalData) {
    const data = [source, symbol || '', timestamp, type, additionalData || ''].join(':');
    return (0, crypto_1.createHash)('sha256').update(data).digest('hex').substring(0, 32);
}
class InMemoryIdempotencyStore {
    store = new Map();
    cleanupInterval = null;
    constructor(cleanupIntervalMs = 60000) {
        // Periodic cleanup every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    }
    async exists(key) {
        const entry = this.store.get(key);
        if (!entry)
            return false;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return false;
        }
        return true;
    }
    async set(key, ttlSeconds = 86400) {
        this.store.set(key, {
            key,
            expiresAt: Date.now() + (ttlSeconds * 1000)
        });
    }
    async delete(key) {
        this.store.delete(key);
    }
    async cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
class FirestoreIdempotencyStore {
    db;
    collection;
    constructor(db, collection = 'idempotency_keys') {
        this.db = db;
        this.collection = collection;
    }
    async exists(key) {
        const doc = await this.db.collection(this.collection).doc(key).get();
        if (!doc.exists)
            return false;
        const data = doc.data();
        if (!data)
            return false;
        // Check expiration
        const expiresAt = data.expiresAt?.toMillis?.() ?? 0;
        if (Date.now() > expiresAt) {
            // Expired, clean up
            await this.delete(key);
            return false;
        }
        return true;
    }
    async set(key, ttlSeconds = 86400) {
        const expiresAt = new Date(Date.now() + (ttlSeconds * 1000));
        await this.db.collection(this.collection).doc(key).set({
            key,
            expiresAt,
            createdAt: new Date()
        });
    }
    async delete(key) {
        await this.db.collection(this.collection).doc(key).delete();
    }
}
// ============ Factory ============
let idempotencyStoreInstance = null;
function createIdempotencyStore(type = 'memory', firestoreDb) {
    if (type === 'firestore' && firestoreDb) {
        return new FirestoreIdempotencyStore(firestoreDb);
    }
    return new InMemoryIdempotencyStore();
}
function getIdempotencyStore() {
    if (!idempotencyStoreInstance) {
        idempotencyStoreInstance = createIdempotencyStore('memory');
    }
    return idempotencyStoreInstance;
}
function setIdempotencyStore(store) {
    idempotencyStoreInstance = store;
}
/**
 * Wrap an event processor with idempotency checking
 */
function withIdempotency(processor, options = {}) {
    const { store = getIdempotencyStore(), keyGenerator = (e) => JSON.stringify(e), ttlSeconds = 86400, onDuplicate } = options;
    return async (event) => {
        const key = (0, crypto_1.createHash)('sha256').update(keyGenerator(event)).digest('hex').substring(0, 32);
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
