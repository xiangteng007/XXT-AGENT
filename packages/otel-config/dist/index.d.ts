/**
 * @xxt/otel-config — Shared OpenTelemetry SDK Configuration (v9.0)
 *
 * Design:
 *   - Unified tracing setup for all XXT-AGENT Cloud Run services
 *   - Exports to GCP Cloud Trace (production) or console (dev/test)
 *   - Uses all dynamic require() to avoid cross-version type conflicts
 *   - MUST be called at the very top of each service's entry point
 *
 * Usage:
 *   import { initTracing } from '@xxt/otel-config';
 *   initTracing({ serviceName: 'openclaw-gateway' });
 */
export interface TracingOptions {
    serviceName: string;
    serviceVersion?: string;
    forceConsole?: boolean;
}
export declare function initTracing(options: TracingOptions): void;
/**
 * Get current trace ID from active span context.
 */
export declare function getCurrentTraceId(): string | undefined;
//# sourceMappingURL=index.d.ts.map