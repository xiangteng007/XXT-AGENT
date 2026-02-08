/**
 * AI Gateway Service
 *
 * Multi-provider AI gateway supporting Gemini, OpenAI GPT, and Anthropic Claude.
 * - Loads API keys from Secret Manager (not exposed to frontend)
 * - Provides unified REST endpoints for AI operations
 * - Rate limiting and request validation
 */
declare const app: import("express-serve-static-core").Express;
export default app;
