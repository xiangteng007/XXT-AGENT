/**
 * GET /audit/logs   — Agent 稽核紀錄查詢
 * GET /audit/stats  — 本日 Token / 費用統計
 */

import { Router, Request, Response } from 'express';
import { getRecentLogs, getDailyStats } from '../audit-logger';

export const auditRouter = Router();

// ── GET /audit/logs ───────────────────────────────────────────
auditRouter.get('/logs', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query['limit'] ?? '50')), 200);

  const logs = await getRecentLogs(limit);
  res.json({
    count: logs.length,
    logs,
  });
});

// ── GET /audit/stats ──────────────────────────────────────────
auditRouter.get('/stats', async (_req: Request, res: Response) => {
  const stats = await getDailyStats();

  const local_pct = stats.total_requests > 0
    ? Math.round((stats.local_requests / stats.total_requests) * 100)
    : 0;

  res.json({
    date: new Date().toISOString().slice(0, 10),
    ...stats,
    local_percentage: local_pct,
    cloud_percentage: 100 - local_pct,
    cost_saved_by_local_usd: stats.local_requests * 0.001,  // 估算：每個本地請求節省約 $0.001
  });
});
