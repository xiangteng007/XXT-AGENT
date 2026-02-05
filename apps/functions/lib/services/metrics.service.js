"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementOkCount = incrementOkCount;
exports.incrementFailedCount = incrementFailedCount;
exports.incrementDlqCount = incrementDlqCount;
exports.incrementNotion429 = incrementNotion429;
exports.incrementNotion5xx = incrementNotion5xx;
exports.recordLatency = recordLatency;
exports.incrementMetric = incrementMetric;
/**
 * Metrics Service - Daily aggregate counters
 */
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
function getDateKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}
function getDocId(tenantId) {
    return `${tenantId}_${getDateKey()}`;
}
/**
 * Increment success count
 */
async function incrementOkCount(tenantId) {
    const db = (0, firebase_1.getDb)();
    const docId = getDocId(tenantId);
    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        ok_count: firestore_1.FieldValue.increment(1),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Increment failed count
 */
async function incrementFailedCount(tenantId) {
    const db = (0, firebase_1.getDb)();
    const docId = getDocId(tenantId);
    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        failed_count: firestore_1.FieldValue.increment(1),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Increment DLQ count
 */
async function incrementDlqCount(tenantId) {
    const db = (0, firebase_1.getDb)();
    const docId = getDocId(tenantId);
    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        dlq_count: firestore_1.FieldValue.increment(1),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Increment Notion 429 count
 */
async function incrementNotion429(tenantId) {
    const db = (0, firebase_1.getDb)();
    const docId = getDocId(tenantId);
    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        notion_429: firestore_1.FieldValue.increment(1),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Increment Notion 5xx count
 */
async function incrementNotion5xx(tenantId) {
    const db = (0, firebase_1.getDb)();
    const docId = getDocId(tenantId);
    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        notion_5xx: firestore_1.FieldValue.increment(1),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Record latency (updates running average)
 */
async function recordLatency(tenantId, latencyMs) {
    const db = (0, firebase_1.getDb)();
    const docId = getDocId(tenantId);
    // For simplicity, just record last latency. 
    // More sophisticated: keep sum + count for true average
    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        last_latency_ms: latencyMs,
        latency_samples: firestore_1.FieldValue.increment(1),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Generic increment function for any metric
 */
async function incrementMetric(tenantId, metricName, count = 1) {
    const db = (0, firebase_1.getDb)();
    const docId = getDocId(tenantId);
    await db.collection('metrics_daily').doc(docId).set({
        tenantId,
        date: getDateKey(),
        [metricName]: firestore_1.FieldValue.increment(count),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
//# sourceMappingURL=metrics.service.js.map