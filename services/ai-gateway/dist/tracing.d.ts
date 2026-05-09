/**
 * tracing.ts — OpenTelemetry 初始化入口 (ai-gateway)
 *
 * 必須在 ai-gateway index.ts 最頂層 import，在 express 之前。
 * v9.0: 動態 require 方式，避免 TS 型別版本衝突
 */
declare const OTEL_ENABLED: boolean;
declare const IS_PRODUCTION: boolean;
