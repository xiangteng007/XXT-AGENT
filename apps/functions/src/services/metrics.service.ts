/**
 * Metrics Service - Daily aggregate counters
 */
import { getDb } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

function getDateKey(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

function getDocId(tenantId: string): string {
    return `${tenantId}_${getDateKey()}`;
}

/**
 * Increment success count
 */
export async function incrementOkCount(tenantId: string): Promise<void> {
    const db = getDb();
    const docId = getDocId(tenantId);

    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        ok_count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Increment failed count
 */
export async function incrementFailedCount(tenantId: string): Promise<void> {
    const db = getDb();
    const docId = getDocId(tenantId);

    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        failed_count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Increment DLQ count
 */
export async function incrementDlqCount(tenantId: string): Promise<void> {
    const db = getDb();
    const docId = getDocId(tenantId);

    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        dlq_count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Increment Notion 429 count
 */
export async function incrementNotion429(tenantId: string): Promise<void> {
    const db = getDb();
    const docId = getDocId(tenantId);

    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        notion_429: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Increment Notion 5xx count
 */
export async function incrementNotion5xx(tenantId: string): Promise<void> {
    const db = getDb();
    const docId = getDocId(tenantId);

    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        notion_5xx: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Record latency (updates running average)
 */
export async function recordLatency(tenantId: string, latencyMs: number): Promise<void> {
    const db = getDb();
    const docId = getDocId(tenantId);

    // For simplicity, just record last latency. 
    // More sophisticated: keep sum + count for true average
    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        last_latency_ms: latencyMs,
        latency_samples: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Generic increment function for any metric
 */
export async function incrementMetric(tenantId: string, metricName: string, count: number = 1): Promise<void> {
    const db = getDb();
    const docId = getDocId(tenantId);

    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        [metricName]: FieldValue.increment(count),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}
