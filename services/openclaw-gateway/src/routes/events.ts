/**
 * POST /events/ingest
 * Execution Plane（Functions/Run）把事件推進 Gateway
 */

import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { EventType } from "@xxt-agent/types";
import type { OpenClawEvent } from "@xxt-agent/types";
import { broadcastEvent } from "../ws-manager";
import { logger } from "../logger";

export const eventsRouter = Router();

eventsRouter.post("/ingest", async (req: Request, res: Response) => {
  const body = req.body as Partial<OpenClawEvent>;

  // 驗證必填欄位
  if (!body.type || !body.source) {
    res.status(400).json({ error: "Missing required fields: type, source" });
    return;
  }

  // 確認 type 是有效的 EventType
  if (!Object.values(EventType).includes(body.type as EventType)) {
    res.status(400).json({ error: `Unknown event type: ${body.type}` });
    return;
  }

  const event: OpenClawEvent = {
    id: body.id ?? randomUUID(),
    type: body.type as EventType,
    severity: body.severity ?? "info",
    source: body.source,
    target_agent: body.target_agent,
    task_id: body.task_id,
    deliberation_id: body.deliberation_id,
    payload: body.payload ?? {},
    timestamp: body.timestamp ?? new Date().toISOString(),
  };

  // 廣播到所有 WS 連線
  broadcastEvent(event);
  logger.info(`Event ingested: ${event.type} from ${event.source}`);

  // Phase 2：寫入 Firestore event log（先留 stub）
  // await firestoreEventLog.write(event);

  res.status(202).json({ ok: true, event_id: event.id });
});
