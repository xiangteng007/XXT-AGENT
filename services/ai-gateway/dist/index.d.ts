/**
 * AI Gateway Service
 *
 * Secure gateway for Gemini AI API calls.
 * - Loads API key from Secret Manager (not exposed to frontend)
 * - Provides REST endpoints for AI operations
 * - Rate limiting and request validation
 */
declare const app: import("express-serve-static-core").Express;
export default app;
