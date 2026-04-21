/**
 * Performance Timer (V3 Audit #15)
 *
 * Lightweight timing wrapper for measuring operation durations.
 * Logs results as structured JSON for Cloud Monitoring integration.
 */
/**
 * Measure and log the duration of an async operation.
 *
 * @example
 * const result = await withTimer('finance.getMonthlySummary', async () => {
 *     return financeService.getMonthlySummary(uid, 2026, 2);
 * });
 */
export declare function withTimer<T>(operationName: string, fn: () => Promise<T>, meta?: Record<string, unknown>): Promise<T>;
/**
 * Create a simple timer for manual start/stop measurements.
 *
 * @example
 * const timer = createTimer();
 * // ... do work ...
 * timer.stop('ai.gemini_response');
 */
export declare function createTimer(): {
    elapsed: () => number;
    stop: (operationName: string, meta?: Record<string, unknown>) => number;
};
//# sourceMappingURL=perf-timer.d.ts.map