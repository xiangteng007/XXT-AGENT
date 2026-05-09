"use strict";
/**
 * tracing.ts — OpenTelemetry 初始化入口 (ai-gateway)
 *
 * 必須在 ai-gateway index.ts 最頂層 import，在 express 之前。
 * v9.0: 動態 require 方式，避免 TS 型別版本衝突
 */
var _a, _b;
const OTEL_ENABLED = process.env['OTEL_ENABLED'] !== 'false';
const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';
(_a = process.env)['OTEL_SERVICE_NAME'] ?? (_a['OTEL_SERVICE_NAME'] = 'ai-gateway');
(_b = process.env)['OTEL_SERVICE_VERSION'] ?? (_b['OTEL_SERVICE_VERSION'] = '9.0.0');
if (OTEL_ENABLED) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NodeSDK } = require('@opentelemetry/sdk-node');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sdkConfig = {
            instrumentations: [
                getNodeAutoInstrumentations({
                    '@opentelemetry/instrumentation-fs': { enabled: false },
                }),
            ],
        };
        if (IS_PRODUCTION && process.env['GOOGLE_CLOUD_PROJECT']) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { TraceExporter } = require('@google-cloud/opentelemetry-cloud-trace-exporter');
                sdkConfig['traceExporter'] = new TraceExporter();
                console.log('[OTEL] ai-gateway → GCP Cloud Trace');
            }
            catch {
                console.warn('[OTEL] GCP Cloud Trace exporter unavailable');
            }
        }
        else {
            console.log('[OTEL] ai-gateway → Console (dev)');
        }
        const sdk = new NodeSDK(sdkConfig);
        sdk.start();
        console.log('[OTEL] Tracing started: ai-gateway v9.0.0');
        process.on('SIGTERM', async () => {
            try {
                await sdk.shutdown();
            }
            catch { /* ignore */ }
        });
    }
    catch (err) {
        console.warn(`[OTEL] Failed to initialize tracing: ${err}`);
    }
}
