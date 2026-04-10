/**
 * app.ts — A-01: Express Application (分離自 index.ts)
 *
 * 將所有路由掛載與中間件配置集中在此處，
 * 使 Express app 可獨立被 supertest 載入進行整合測試，
 * 而不需要啟動 http.Server + WebSocket。
 *
 * index.ts 負責：HTTP server、WebSocket、graceful shutdown
 * 本檔負責：Express app 設定、路由掛載、中間件
 */

import helmet from "helmet";
import express, { Request, Response, NextFunction } from "express";
import { localRunner } from "./local-runner-circuit-breaker";
import { getWss } from "./ws-manager";
import { eventsRouter } from "./routes/events";
import { agentsRouter } from "./routes/agents";
import { proxyRouter } from "./routes/proxy";
import { deliberationRouter } from "./routes/deliberation";
import { investRouter } from "./routes/invest";
import { vramRouter } from "./routes/vram";
import { systemRouter } from "./routes/system";
import { agentBusRouter } from "./routes/agent-bus";
import { auditRouter } from "./routes/audit";
import { regulationRouter } from "./routes/regulation";
import { accountantRouter } from "./routes/accountant";
import { guardianRouter } from "./routes/guardian";
import { financeRouter } from "./routes/finance";
import { bimRouter } from "./routes/bim";
import { interiorRouter } from "./routes/interior";
import { estimatorRouter } from "./routes/estimator";
import { scoutRouter } from "./routes/scout";
import { zoraRouter } from "./routes/zora";
import { lexRouter } from "./routes/lex";
import { firebaseAuthMiddleware } from "./middleware/firebase-auth";
import { globalRateLimit, agentRateLimit, financeRateLimit, getRateLimitStats } from "./middleware/rate-limiter";
import { requestIdMiddleware, globalErrorHandler, notFoundHandler } from "./middleware/error-handler";
import { getContextStoreStats } from "./context-store";

// ── 設定 ──────────────────────────────────────────────────────
const DEPLOY_MODE = process.env["DEPLOY_MODE"] ?? "local";

// S-01: CORS 白名單由環境變數控制（生產環境不應包含 localhost）
export const ALLOWED_ORIGINS = process.env["CORS_ALLOWED_ORIGINS"]
  ? process.env["CORS_ALLOWED_ORIGINS"].split(",").map(s => s.trim())
  : [
      "http://localhost:3000",
      "http://localhost:3100",
      "http://localhost:5173",
      "https://xxt-agent-dashboard.vercel.app",
      "https://xxt-frontend.vercel.app",
    ];

// ── Express 應用 ──────────────────────────────────────────────
export const app = express();

// M-04: Cloud Run 代理層必須啟用 trust proxy
app.set('trust proxy', true);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(requestIdMiddleware);
app.use(globalRateLimit);

// CORS
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Request-ID",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// ── 公開路由（不需 Auth）─────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  let wsConnections = 0;
  try { wsConnections = getWss().clients.size; } catch { /* WS not init in tests */ }

  res.json({
    status: "ok",
    deploy_mode: DEPLOY_MODE,
    local_runner: localRunner.getStatus(),
    ws_connections: wsConnections,
    context_store: getContextStoreStats(),
    rate_limit_stats: getRateLimitStats(),
    server_time: new Date().toISOString(),
  });
});

app.use("/vram", vramRouter);
app.use("/system", systemRouter);
app.use("/system/agent-bus", agentBusRouter);

// ── 保護路由（需 Firebase JWT）────────────────────────────────
app.use("/events", firebaseAuthMiddleware, eventsRouter);
app.use("/agents", firebaseAuthMiddleware, agentsRouter);
app.use("/proxy", firebaseAuthMiddleware, proxyRouter);
app.use("/deliberation", firebaseAuthMiddleware, deliberationRouter);
app.use("/invest", firebaseAuthMiddleware, investRouter);
app.use("/audit", firebaseAuthMiddleware, auditRouter);
app.use("/regulation", firebaseAuthMiddleware, regulationRouter);

// Division 5 — Financial Layer (強制 PRIVATE + 財務速率限制)
app.use("/agents/accountant", firebaseAuthMiddleware, financeRateLimit, accountantRouter);
app.use("/agents/guardian", firebaseAuthMiddleware, financeRateLimit, guardianRouter);
app.use("/agents/finance", firebaseAuthMiddleware, financeRateLimit, financeRouter);

// Division 6 — Engineering & Spatial Design Layer
app.use("/agents/bim", firebaseAuthMiddleware, bimRouter);
app.use("/agents/interior", firebaseAuthMiddleware, interiorRouter);
app.use("/agents/estimator", firebaseAuthMiddleware, estimatorRouter);

// Division 7 — Business Operations Layer (v2.0)
app.use("/agents/scout", firebaseAuthMiddleware, agentRateLimit, scoutRouter);
app.use("/agents/zora", firebaseAuthMiddleware, agentRateLimit, zoraRouter);
app.use("/agents/lex", firebaseAuthMiddleware, agentRateLimit, lexRouter);

// ── 404 + 全局 Error Handler（必須在所有路由之後）────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);
