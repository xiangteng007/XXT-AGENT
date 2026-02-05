/**
 * Increment success count
 */
export declare function incrementOkCount(tenantId: string): Promise<void>;
/**
 * Increment failed count
 */
export declare function incrementFailedCount(tenantId: string): Promise<void>;
/**
 * Increment DLQ count
 */
export declare function incrementDlqCount(tenantId: string): Promise<void>;
/**
 * Increment Notion 429 count
 */
export declare function incrementNotion429(tenantId: string): Promise<void>;
/**
 * Increment Notion 5xx count
 */
export declare function incrementNotion5xx(tenantId: string): Promise<void>;
/**
 * Record latency (updates running average)
 */
export declare function recordLatency(tenantId: string, latencyMs: number): Promise<void>;
/**
 * Generic increment function for any metric
 */
export declare function incrementMetric(tenantId: string, metricName: string, count?: number): Promise<void>;
//# sourceMappingURL=metrics.service.d.ts.map