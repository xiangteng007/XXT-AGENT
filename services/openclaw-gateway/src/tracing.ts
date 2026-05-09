/**
 * tracing.ts — OpenTelemetry 初始化入口 (openclaw-gateway)
 *
 * 重要：此檔必須在 index.ts 的最頂層 import，
 * 在 express / firebase / 所有其他 import 之前執行。
 *
 * v9.0: 使用環境變數 OTEL_SERVICE_NAME / OTEL_SERVICE_VERSION
 *       讓 SDK 自動讀取，避免 Resource API 版本差異
 */

const OTEL_ENABLED = process.env['OTEL_ENABLED'] !== 'false';
const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';

// 設定環境變數讓 NodeSDK 自動採用（OTEL 標準方式）
process.env['OTEL_SERVICE_NAME'] ??= 'openclaw-gateway';
process.env['OTEL_SERVICE_VERSION'] ??= '9.0.0';

if (OTEL_ENABLED) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NodeSDK } = require('@opentelemetry/sdk-node') as typeof import('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node') as typeof import('@opentelemetry/auto-instrumentations-node');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdkConfig: Record<string, any> = {
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    };

    // GCP Cloud Trace Exporter (生產環境)
    if (IS_PRODUCTION && process.env['GOOGLE_CLOUD_PROJECT']) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { TraceExporter } = require('@google-cloud/opentelemetry-cloud-trace-exporter') as { TraceExporter: new () => unknown };
        sdkConfig['traceExporter'] = new TraceExporter();
        console.log('[OTEL] openclaw-gateway → GCP Cloud Trace');
      } catch {
        console.warn('[OTEL] GCP Cloud Trace exporter unavailable');
      }
    } else {
      console.log('[OTEL] openclaw-gateway → Console (dev)');
    }

    const sdk = new NodeSDK(sdkConfig);
    sdk.start();
    console.log('[OTEL] Tracing started: openclaw-gateway v9.0.0');

    process.on('SIGTERM', async () => {
      try { await sdk.shutdown(); } catch { /* ignore */ }
    });
  } catch (err) {
    console.warn(`[OTEL] Failed to initialize tracing: ${err}`);
  }
}
