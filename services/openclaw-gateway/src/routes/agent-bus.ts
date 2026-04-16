/**
 * D-10: Agent 健康監控 Bus
 *
 * GET /system/agent-bus    — 全系統 Agent 健康摘要（聚合所有 /health 端點）
 *
 * 設計原則：
 *   - 並行查詢所有已知 Agent 的 /health 端點
 *   - 回傳統一格式，包含首次回應時間 (latency)
 *   - 超過 3 秒未回應標記為 timeout
 *   - 此端點本身為公開路由（不需 Auth），因為健康狀態不含敏感資料
 */

import { Router, Request, Response } from 'express';
import { logger } from '../logger';
import { writeRequestQueue } from '../write-request-queue';

export const agentBusRouter = Router();

const GATEWAY_BASE = process.env['GATEWAY_INTERNAL_URL'] ?? 'http://localhost:3100';

const KNOWN_AGENTS: Array<{ id: string; name: string; endpoint: string }> = [
  { id: 'accountant', name: '鳴鑫 (Accountant)',     endpoint: '/agents/accountant/health' },
  { id: 'guardian',   name: '安盾 (Guardian)',        endpoint: '/agents/guardian/health' },
  { id: 'finance',    name: '融鑫 (Finance)',         endpoint: '/agents/finance/health' },
  { id: 'scout',      name: 'Scout (UAV)',            endpoint: '/agents/scout/health' },
  { id: 'zora',       name: 'Zora (NGO)',             endpoint: '/agents/zora/health' },
  { id: 'nova',       name: 'Nova (HR)',              endpoint: '/agents/nova/health' },
  { id: 'lex',        name: 'Lex (合約管家)',          endpoint: '/agents/lex/health' },
  { id: 'titan',      name: 'Titan (BIM)',            endpoint: '/agents/bim/health' },
  { id: 'lumi',       name: 'Lumi (Interior)',        endpoint: '/agents/interior/health' },
  { id: 'rusty',      name: 'Rusty (Estimator)',      endpoint: '/agents/estimator/health' },
  { id: 'sage',       name: 'Sage (Analytics)',       endpoint: '/agents/sage/health' },
];

const HEALTH_HISTORY: Array<{ timestamp: string; event: string; details: any }> = [];
const MAX_HISTORY = 100;

function addHistory(event: string, details: any) {
  HEALTH_HISTORY.unshift({ timestamp: new Date().toISOString(), event, details });
  if (HEALTH_HISTORY.length > MAX_HISTORY) HEALTH_HISTORY.pop();
}

interface AgentHealthResult {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'timeout' | 'error';
  latency_ms: number;
  details?: unknown;
  error?: string;
}

async function probeAgent(agent: typeof KNOWN_AGENTS[0]): Promise<AgentHealthResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const resp = await fetch(`${GATEWAY_BASE}${agent.endpoint}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${process.env['OPENCLAW_API_KEY'] ?? 'dev-secret-key'}` },
    });
    clearTimeout(timeout);

    const latency_ms = Date.now() - start;

    if (!resp.ok) {
      return { id: agent.id, name: agent.name, status: 'error', latency_ms, error: `HTTP ${resp.status}` };
    }

    const details = await resp.json();
    return { id: agent.id, name: agent.name, status: 'online', latency_ms, details };
  } catch (err) {
    const latency_ms = Date.now() - start;
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      id: agent.id,
      name: agent.name,
      status: isTimeout ? 'timeout' : 'offline',
      latency_ms,
      error: isTimeout ? 'timeout (>3s)' : String(err),
    };
  }
}

// ── GET /system/agent-bus ──────────────────────────────────────
agentBusRouter.get('/', async (_req: Request, res: Response) => {
  logger.info('[AgentBus] Polling all agent health endpoints...');
  const startAll = Date.now();

  // 並行探查所有 Agent（不互相等待）
  const results = await Promise.all(KNOWN_AGENTS.map(probeAgent));

  const online  = results.filter(r => r.status === 'online').length;
  const offline = results.filter(r => r.status !== 'online').length;
  const maxLatency = Math.max(...results.map(r => r.latency_ms));

  const wrqStats = writeRequestQueue.getStats();

  logger.info(`[AgentBus] Poll complete: ${online}/${KNOWN_AGENTS.length} online, took ${Date.now() - startAll}ms`);

  res.json({
    summary: {
      total: results.length,
      online,
      offline,
      max_latency_ms: maxLatency,
      polled_at: new Date().toISOString(),
    },
    agents: results,
    write_request_queue: wrqStats,
  });
});

/**
 * @openapi
 * /system/agent-bus/history:
 *   get:
 *     tags: [System]
 *     summary: 取得 Agent Bus 活動歷史
 *     description: 回傳最近 100 筆 Agent 健康狀態變遷或系統事件
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: 成功回傳統計資料
 */
agentBusRouter.get('/history', (_req: Request, res: Response) => {
  res.json({
    total: HEALTH_HISTORY.length,
    history: HEALTH_HISTORY,
  });
});
