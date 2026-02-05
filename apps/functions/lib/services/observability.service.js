"use strict";
/**
 * Observability Service
 *
 * Real-time metrics collection per SPEC_PHASE6_5_PHASE7_CLOUD.md
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.METRICS = void 0;
exports.recordMetric = recordMetric;
exports.recordLatencyMetric = recordLatencyMetric;
exports.checkDlqAlert = checkDlqAlert;
exports.check429Alert = check429Alert;
exports.getMetricsSummary = getMetricsSummary;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const db = admin.firestore();
// Metric names per spec
exports.METRICS = {
    COLLECTOR_RUNS_TOTAL: 'collector_runs_total',
    COLLECTOR_ERRORS_TOTAL: 'collector_errors_total',
    RATE_LIMIT_429_TOTAL: 'rate_limit_429_total',
    PIPELINE_LATENCY_MS: 'pipeline_latency_ms',
    FUSED_EVENTS_CREATED_TOTAL: 'fused_events_created_total',
    NOTIFICATIONS_SENT_TOTAL: 'notifications_sent_total',
    DLQ_TOTAL: 'dlq_total',
};
/**
 * Record a metric value
 */
async function recordMetric(entry) {
    const hourKey = getHourKey();
    const docId = `${entry.tenantId}_${entry.name}_${hourKey}`;
    await db.collection('metrics_realtime').doc(docId).set({
        tenantId: entry.tenantId,
        name: entry.name,
        hourKey,
        value: firestore_1.FieldValue.increment(entry.value),
        labels: entry.labels || {},
        lastUpdated: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Record pipeline latency (keeps running average)
 */
async function recordLatencyMetric(tenantId, latencyMs, pipelineName) {
    const hourKey = getHourKey();
    const docId = `${tenantId}_${exports.METRICS.PIPELINE_LATENCY_MS}_${pipelineName}_${hourKey}`;
    await db.collection('metrics_realtime').doc(docId).set({
        tenantId,
        name: exports.METRICS.PIPELINE_LATENCY_MS,
        pipeline: pipelineName,
        hourKey,
        latencySum: firestore_1.FieldValue.increment(latencyMs),
        latencyCount: firestore_1.FieldValue.increment(1),
        lastLatency: latencyMs,
        lastUpdated: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Check if DLQ threshold exceeded (for alerting)
 */
async function checkDlqAlert(tenantId) {
    const hourKey = getHourKey();
    const docId = `${tenantId}_${exports.METRICS.DLQ_TOTAL}_${hourKey}`;
    const doc = await db.collection('metrics_realtime').doc(docId).get();
    if (!doc.exists)
        return false;
    const data = doc.data();
    return (data?.value || 0) > 0;
}
/**
 * Check if 429 rate exceeded (for alerting)
 */
async function check429Alert(tenantId, threshold = 10) {
    const hourKey = getHourKey();
    const docId = `${tenantId}_${exports.METRICS.RATE_LIMIT_429_TOTAL}_${hourKey}`;
    const doc = await db.collection('metrics_realtime').doc(docId).get();
    if (!doc.exists)
        return false;
    const data = doc.data();
    return (data?.value || 0) > threshold;
}
/**
 * Get metrics summary for dashboard
 */
async function getMetricsSummary(tenantId) {
    const hourKey = getHourKey();
    const summary = {};
    const snapshot = await db.collection('metrics_realtime')
        .where('tenantId', '==', tenantId)
        .where('hourKey', '==', hourKey)
        .get();
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const name = data.name;
        if (name === exports.METRICS.PIPELINE_LATENCY_MS) {
            summary[`${name}_avg`] = data.latencyCount > 0
                ? Math.round(data.latencySum / data.latencyCount)
                : 0;
        }
        else {
            summary[name] = data.value || 0;
        }
    }
    return summary;
}
function getHourKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    return `${y}${m}${d}${h}`;
}
//# sourceMappingURL=observability.service.js.map