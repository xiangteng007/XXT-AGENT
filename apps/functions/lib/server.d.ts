/**
 * Local Desktop / Cloud Run Entry Point
 *
 * Standalone Express HTTP server.
 * - Local Desktop: 讀取 .env.local，port 3000，使用 Cloudflare Tunnel 暴露
 * - Cloud Run:     使用 GCP Application Default Credentials，port 8080
 *
 * Secret priority (via config/secrets.ts):
 *   1. In-memory cache
 *   2. process.env (此處 dotenv 注入)
 *   3. GCP Secret Manager (fallback)
 */
declare const app: import("express-serve-static-core").Express;
export default app;
//# sourceMappingURL=server.d.ts.map