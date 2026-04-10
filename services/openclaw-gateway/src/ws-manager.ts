/**
 * WebSocket Manager
 * 集中管理 WSS 實例與廣播邏輯
 */

import { WebSocketServer, WebSocket } from "ws";
import type { OpenClawEvent } from "@xxt-agent/types";
import { logger } from "./logger";

let _wss: WebSocketServer | null = null;

export function initWss(wss: WebSocketServer): void {
  _wss = wss;
}

export function getWss(): WebSocketServer {
  if (!_wss) throw new Error("WSS not initialized");
  return _wss;
}

export function broadcastEvent(event: OpenClawEvent): void {
  if (!_wss) return;

  const payload = JSON.stringify({ type: "openclaw_event", event });
  let sent = 0;

  _wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent++;
    }
  });

  logger.info(`Broadcast ${event.type} → ${sent} client(s)`);
}
