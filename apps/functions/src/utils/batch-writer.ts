/**
 * Firestore Batch Writer (V3 Audit #23)
 * 
 * Utility for efficient bulk writes to Firestore.
 * Automatically splits operations into batches of 500 (Firestore limit).
 */

import { logger } from 'firebase-functions/v2';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';

const MAX_BATCH_SIZE = 500;

export interface BatchOperation {
    type: 'set' | 'update' | 'delete';
    ref: FirebaseFirestore.DocumentReference;
    data?: Record<string, unknown>;
    options?: FirebaseFirestore.SetOptions;
}

/**
 * Execute multiple Firestore operations in batched writes.
 * Automatically splits into chunks of 500 to respect Firestore limits.
 */
export async function executeBatchWrites(
    operations: BatchOperation[]
): Promise<{ total: number; batches: number }> {
    const db = getFirestore();
    const chunks = chunkArray(operations, MAX_BATCH_SIZE);
    
    for (const chunk of chunks) {
        const batch: WriteBatch = db.batch();
        for (const op of chunk) {
            switch (op.type) {
                case 'set':
                    if (op.options) {
                        batch.set(op.ref, op.data || {}, op.options);
                    } else {
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

    logger.info('[BatchWriter] Completed', {
        total: operations.length,
        batches: chunks.length,
    });

    return { total: operations.length, batches: chunks.length };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}
