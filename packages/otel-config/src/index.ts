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

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

export interface TracingOptions {
  serviceName: string;
  serviceVersion?: string;
  forceConsole?: boolean;
}

let _initialized = false;

export function initTracing(options: TracingOptions): void {
  if (_initialized) return;
  _initialized = true;

  const {
    serviceName,
    serviceVersion = process.env['npm_package_version'] ?? '9.0.0',
    forceConsole = false,
  } = options;

  const isProduction = process.env['NODE_ENV'] === 'production';
  const hasGcpProject = Boolean(
    process.env['GOOGLE_CLOUD_PROJECT'] ?? process.env['GCLOUD_PROJECT']
  );

  try {
    // All OTEL imports via dynamic require to avoid version mismatch
    const { NodeSDK } = require('@opentelemetry/sdk-node') as any;
    const { Resource } = require('@opentelemetry/resources') as any;
    const semconv = require('@opentelemetry/semantic-conventions') as any;
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node') as any;

    const SERVICE_NAME_ATTR = semconv.SEMRESATTRS_SERVICE_NAME ?? 'service.name';
    const SERVICE_VERSION_ATTR = semconv.SEMRESATTRS_SERVICE_VERSION ?? 'service.version';

    let traceExporter: any;

    if (isProduction && hasGcpProject && !forceConsole) {
      try {
        const { TraceExporter } = require('@google-cloud/opentelemetry-cloud-trace-exporter') as any;
        traceExporter = new TraceExporter();
        console.log(`[OTEL] ${serviceName} → GCP Cloud Trace`);
      } catch {
        const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base') as any;
        traceExporter = new ConsoleSpanExporter();
        console.log(`[OTEL] ${serviceName} → Console (GCP exporter unavailable)`);
      }
    } else {
      const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base') as any;
      traceExporter = new ConsoleSpanExporter();
      console.log(`[OTEL] ${serviceName} → Console exporter`);
    }

    const sdk = new NodeSDK({
      resource: new Resource({
        [SERVICE_NAME_ATTR]: serviceName,
        [SERVICE_VERSION_ATTR]: serviceVersion,
        'deployment.environment': process.env['NODE_ENV'] ?? 'development',
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    sdk.start();
    console.log(`[OTEL] Tracing initialized: ${serviceName} v${serviceVersion}`);

    process.on('SIGTERM', () => {
      (sdk.shutdown() as Promise<void>)
        .then(() => console.log('[OTEL] Shutdown complete'))
        .catch((err: unknown) => console.error('[OTEL] Shutdown error:', err));
    });
  } catch (err) {
    console.warn(`[OTEL] Failed to initialize for ${serviceName}:`, err);
  }
}

/**
 * Get current trace ID from active span context.
 */
export function getCurrentTraceId(): string | undefined {
  try {
    const { trace, context } = require('@opentelemetry/api') as any;
    const span = trace.getSpan(context.active());
    if (!span) return undefined;
    const ctx = span.spanContext();
    return ctx.traceId !== '00000000000000000000000000000000' ? ctx.traceId : undefined;
  } catch {
    return undefined;
  }
}
