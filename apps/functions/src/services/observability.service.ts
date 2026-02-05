/**
 * Observability Service
 * 
 * Real-time metrics collection per SPEC_PHASE6_5_PHASE7_CLOUD.md
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

// Metric names per spec
export const METRICS = {
    COLLECTOR_RUNS_TOTAL: 'collector_runs_total',
    COLLECTOR_ERRORS_TOTAL: 'collector_errors_total',
    RATE_LIMIT_429_TOTAL: 'rate_limit_429_total',
    PIPELINE_LATENCY_MS: 'pipeline_latency_ms',
    FUSED_EVENTS_CREATED_TOTAL: 'fused_events_created_total',
    NOTIFICATIONS_SENT_TOTAL: 'notifications_sent_total',
    DLQ_TOTAL: 'dlq_total',
} as const;

interface MetricEntry {
    name: string;
    value: number;
    tenantId: string;
    timestamp: Date;
    labels?: Record<string, string>;
}

/**
 * Record a metric value
 */
export async function recordMetric(entry: MetricEntry): Promise<void> {
    const hourKey = getHourKey();
    const docId = `${entry.tenantId}_${entry.name}_${hourKey}`;

    await db.collection('metrics_realtime').doc(docId).set({
        tenantId: entry.tenantId,
        name: entry.name,
        hourKey,
        value: FieldValue.increment(entry.value),
        labels: entry.labels || {},
        lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Record pipeline latency (keeps running average)
 */
export async function recordLatencyMetric(
    tenantId: string,
    latencyMs: number,
    pipelineName: string
): Promise<void> {
    const hourKey = getHourKey();
    const docId = `${tenantId}_${METRICS.PIPELINE_LATENCY_MS}_${pipelineName}_${hourKey}`;

    await db.collection('metrics_realtime').doc(docId).set({
        tenantId,
        name: METRICS.PIPELINE_LATENCY_MS,
        pipeline: pipelineName,
        hourKey,
        latencySum: FieldValue.increment(latencyMs),
        latencyCount: FieldValue.increment(1),
        lastLatency: latencyMs,
        lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Check if DLQ threshold exceeded (for alerting)
 */
export async function checkDlqAlert(tenantId: string): Promise<boolean> {
    const hourKey = getHourKey();
    const docId = `${tenantId}_${METRICS.DLQ_TOTAL}_${hourKey}`;

    const doc = await db.collection('metrics_realtime').doc(docId).get();
    if (!doc.exists) return false;

    const data = doc.data();
    return (data?.value || 0) > 0;
}

/**
 * Check if 429 rate exceeded (for alerting)
 */
export async function check429Alert(tenantId: string, threshold: number = 10): Promise<boolean> {
    const hourKey = getHourKey();
    const docId = `${tenantId}_${METRICS.RATE_LIMIT_429_TOTAL}_${hourKey}`;

    const doc = await db.collection('metrics_realtime').doc(docId).get();
    if (!doc.exists) return false;

    const data = doc.data();
    return (data?.value || 0) > threshold;
}

/**
 * Get metrics summary for dashboard
 */
export async function getMetricsSummary(tenantId: string): Promise<Record<string, number>> {
    const hourKey = getHourKey();
    const summary: Record<string, number> = {};

    const snapshot = await db.collection('metrics_realtime')
        .where('tenantId', '==', tenantId)
        .where('hourKey', '==', hourKey)
        .get();

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const name = data.name;

        if (name === METRICS.PIPELINE_LATENCY_MS) {
            summary[`${name}_avg`] = data.latencyCount > 0
                ? Math.round(data.latencySum / data.latencyCount)
                : 0;
        } else {
            summary[name] = data.value || 0;
        }
    }

    return summary;
}

function getHourKey(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    return `${y}${m}${d}${h}`;
}
