/**
 * AI Gateway Service (v9.0)
 *
 * Multi-provider AI gateway supporting Gemini, OpenAI GPT, and Anthropic Claude.
 * - Loads API keys from Secret Manager (not exposed to frontend)
 * - Provides unified REST endpoints for AI operations
 * - Rate limiting and request validation
 * - MCP-ready architecture (providers + tools separation)
 *
 * Refactored 2026-03-27: Split from monolithic 573-line file into modules.
 * v9.0: OpenTelemetry 全鏈路追蹤已啟用
 */
import './tracing';
declare const app: import("express-serve-static-core").Express;
export default app;
