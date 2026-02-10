/**
 * Performance Timer (V3 Audit #15)
 * 
 * Lightweight timing wrapper for measuring operation durations.
 * Logs results as structured JSON for Cloud Monitoring integration.
 */

import { logger } from 'firebase-functions/v2';

/**
 * Measure and log the duration of an async operation.
 * 
 * @example
 * const result = await withTimer('finance.getMonthlySummary', async () => {
 *     return financeService.getMonthlySummary(uid, 2026, 2);
 * });
 */
export async function withTimer<T>(
    operationName: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>
): Promise<T> {
    const start = Date.now();
    try {
        const result = await fn();
        const durationMs = Date.now() - start;
        logger.info('perf_metric', {
            operation: operationName,
            duration_ms: durationMs,
            status: 'success',
            ...meta,
        });
        return result;
    } catch (error) {
        const durationMs = Date.now() - start;
        logger.error('perf_metric', {
            operation: operationName,
            duration_ms: durationMs,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            ...meta,
        });
        throw error;
    }
}

/**
 * Create a simple timer for manual start/stop measurements.
 * 
 * @example
 * const timer = createTimer();
 * // ... do work ...
 * timer.stop('ai.gemini_response');
 */
export function createTimer() {
    const start = Date.now();
    return {
        elapsed: () => Date.now() - start,
        stop: (operationName: string, meta?: Record<string, unknown>) => {
            const durationMs = Date.now() - start;
            logger.info('perf_metric', {
                operation: operationName,
                duration_ms: durationMs,
                ...meta,
            });
            return durationMs;
        },
    };
}
