/**
 * OpenClaw Gateway — Server Entry Point
 *
 * A-01: 路由設定已模組化至 app.ts
 * 本檔僅負責：HTTP Server、WebSocket、Graceful Shutdown
 */

import "dotenv/config";
import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { localRunner } from "./local-runner-circuit-breaker";
import { broadcastEvent } from "./ws-manager";
import { logger } from "./logger";
import { app, ALLOWED_ORIGINS } from "./app";

// ── 設定 ──────────────────────────────────────────────────────
const PORT = parseInt(process.env["PORT"] ?? "3100", 10);
const DEPLOY_MODE = process.env["DEPLOY_MODE"] ?? "local";
const WS_HEARTBEAT_MS = parseInt(
  process.env["WS_HEARTBEAT_MS"] ?? "25000",
  10,
);


// ── HTTP + WebSocket 伺服器 ────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// 初始化 WS Manager（讓 wss 實例可被 broadcastEvent 使用）
import { initWss } from "./ws-manager";
initWss(wss);

// WS：連線處理（含 JWT 驗證 — CR-04）
wss.on("connection", async (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress ?? "unknown";
  const DEV_BYPASS = process.env["DEV_BYPASS_AUTH"] === "true" && process.env["NODE_ENV"] !== "production";

  // ── S-04: WebSocket Origin 驗證 ────────────────────────────
  // 防止跨站 WebSocket 劫持（CSWSH）攻擊
  const origin = req.headers.origin;
  if (origin) {
    const isAllowedOrigin = ALLOWED_ORIGINS.some(
      (allowed) => allowed === origin || origin.startsWith(allowed)
    );
    if (!isAllowedOrigin) {
      logger.warn(`WS rejected: disallowed origin "${origin}" from ${clientIp}`);
      ws.close(4403, "Forbidden: origin not allowed");
      return;
    }
  }
  // 若無 Origin header（如 CLI/伺服器端 WS 客戶端），僅在生產環境嚴格拒絕
  else if (process.env["NODE_ENV"] === "production") {
    logger.warn(`WS rejected: missing Origin header from ${clientIp}`);
    ws.close(4403, "Forbidden: missing origin");
    return;
  }

  // ── CR-04: WebSocket JWT 驗證 ──────────────────────────────
  if (!DEV_BYPASS) {
    try {
      // 從 URL query 取得 token: ws://host/ws?token=xxx
      const url = new URL(req.url ?? "", `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      if (!token) {
        logger.warn(`WS auth failed from ${clientIp}: missing token`);
        ws.close(4401, "Unauthorized: missing token");
        return;
      }

      // 驗證 Firebase JWT
      const { getAuth } = await import("firebase-admin/auth");
      await getAuth().verifyIdToken(token);
    } catch (err) {
      logger.warn(`WS auth failed from ${clientIp}: ${err instanceof Error ? err.message : err}`);
      ws.close(4401, "Unauthorized: invalid token");
      return;
    }
  }

  logger.info(`WS connected from ${clientIp}. Total: ${wss.clients.size}`);

  // WS 心跳（ping/pong）
  let isAlive = true;
  ws.on("pong", () => { isAlive = true; });

  const heartbeatTimer = setInterval(() => {
    if (!isAlive) {
      logger.info("WS client heartbeat timeout, terminating.");
      ws.terminate();
      return;
    }
    isAlive = false;
    ws.ping();
  }, WS_HEARTBEAT_MS);

  ws.on("close", () => {
    clearInterval(heartbeatTimer);
    logger.info(`WS disconnected. Remaining: ${wss.clients.size}`);
  });

  ws.on("error", (err) => {
    logger.error("WS error:", err.message);
    clearInterval(heartbeatTimer);
  });

  // 收到訊息（Office → Gateway）
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as { type: string };
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    } catch {
      // 忽略非 JSON 訊息
    }
  });
});

// ── 啟動時的 Local Runner 狀態初始化 ─────────────────────────
server.listen(PORT, async () => {
  logger.info(`OpenClaw Gateway listening on port ${PORT}`);
  logger.info(`Deploy mode: ${DEPLOY_MODE}`);

  // 觸發初始 Local Runner 狀態偵測
  const initialStatus = await localRunner.probe();
  if (initialStatus.event) {
    // 廣播初始狀態給所有 WS 連線（啟動時可能還沒有連線，先記 log）
    logger.info(`Local Runner initial state: ${initialStatus.event.type}`);
    broadcastEvent(initialStatus.event);
  }
});

// ── M-07: Graceful Shutdown ──────────────────────────────────
function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // 1. 關閉所有 WebSocket 連線
  wss.clients.forEach((ws) => {
    ws.close(1001, "Server shutting down");
  });

  // 2. 停止接受新請求並排空現有連線
  server.close(() => {
    logger.info("HTTP server closed. Goodbye.");
    process.exit(0);
  });

  // 3. 超時強制退出（Cloud Run 給 10 秒）
  setTimeout(() => {
    logger.warn("Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 8000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
