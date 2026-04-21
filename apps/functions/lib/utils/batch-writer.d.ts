/**
 * Firestore Batch Writer (V3 Audit #23)
 *
 * Utility for efficient bulk writes to Firestore.
 * Automatically splits operations into batches of 500 (Firestore limit).
 */
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
export declare function executeBatchWrites(operations: BatchOperation[]): Promise<{
    total: number;
    batches: number;
}>;
//# sourceMappingURL=batch-writer.d.ts.map