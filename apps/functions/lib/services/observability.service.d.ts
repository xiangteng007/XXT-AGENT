/**
 * Observability Service
 *
 * Real-time metrics collection per SPEC_PHASE6_5_PHASE7_CLOUD.md
 */
export declare const METRICS: {
    readonly COLLECTOR_RUNS_TOTAL: "collector_runs_total";
    readonly COLLECTOR_ERRORS_TOTAL: "collector_errors_total";
    readonly RATE_LIMIT_429_TOTAL: "rate_limit_429_total";
    readonly PIPELINE_LATENCY_MS: "pipeline_latency_ms";
    readonly FUSED_EVENTS_CREATED_TOTAL: "fused_events_created_total";
    readonly NOTIFICATIONS_SENT_TOTAL: "notifications_sent_total";
    readonly DLQ_TOTAL: "dlq_total";
};
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
export declare function recordMetric(entry: MetricEntry): Promise<void>;
/**
 * Record pipeline latency (keeps running average)
 */
export declare function recordLatencyMetric(tenantId: string, latencyMs: number, pipelineName: string): Promise<void>;
/**
 * Check if DLQ threshold exceeded (for alerting)
 */
export declare function checkDlqAlert(tenantId: string): Promise<boolean>;
/**
 * Check if 429 rate exceeded (for alerting)
 */
export declare function check429Alert(tenantId: string, threshold?: number): Promise<boolean>;
/**
 * Get metrics summary for dashboard
 */
export declare function getMetricsSummary(tenantId: string): Promise<Record<string, number>>;
export {};
//# sourceMappingURL=observability.service.d.ts.map