"use strict";
/**
 * Firestore Batch Writer (V3 Audit #23)
 *
 * Utility for efficient bulk writes to Firestore.
 * Automatically splits operations into batches of 500 (Firestore limit).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeBatchWrites = executeBatchWrites;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const MAX_BATCH_SIZE = 500;
/**
 * Execute multiple Firestore operations in batched writes.
 * Automatically splits into chunks of 500 to respect Firestore limits.
 */
async function executeBatchWrites(operations) {
    const db = (0, firestore_1.getFirestore)();
    const chunks = chunkArray(operations, MAX_BATCH_SIZE);
    for (const chunk of chunks) {
        const batch = db.batch();
        for (const op of chunk) {
            switch (op.type) {
                case 'set':
                    if (op.options) {
                        batch.set(op.ref, op.data || {}, op.options);
                    }
                    else {
                        batch.set(op.ref, op.data || {});
                    }
                    break;
                case 'update':
                    batch.update(op.ref, op.data || {});
                    break;
                case 'delete':
                    batch.delete(op.ref);
                    break;
            }
        }
        await batch.commit();
    }
    v2_1.logger.info('[BatchWriter] Completed', {
        total: operations.length,
        batches: chunks.length,
    });
    return { total: operations.length, batches: chunks.length };
}
function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}
//# sourceMappingURL=batch-writer.js.map