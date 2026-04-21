import { Router, Request, Response } from 'express';
import { localRunner } from '../local-runner-circuit-breaker';
import { getRunningModels } from '../ollama-inference.service';
import { writeRequestQueue } from '../write-request-queue';
import { costTracker } from '../cost-tracker';
import { getRateLimitStats } from '../middleware/rate-limiter';
import { logger } from '../logger';

export const systemRouter = Router();

const OLLAMA_BASE = process.env['LOCAL_RUNNER_BASE_URL'] ?? 'http://localhost:11434';
const AI_GATEWAY = process.env['AI_GATEWAY_URL'] ?? 'http://localhost:8080';

// 已知 Agent 清單（與 agent-bus.ts 同步）
const KNOWN_AGENT_COUNT = 11;

// ── GET /system/health ────────────────────────────────────────
/**
 * @openapi
 * /system/health:
 *   get:
 *     tags: [System]
 *     summary: 系統深度健康狀態（D-5 Dashboard）
 *     description: 回傳本地 Ollama / 雲端 Gateway / Agent Bus / AI 成本 / WRQ 的整合健康狀態
 *     responses:
 *       200:
 *         description: 系統健康狀態
 */
systemRouter.get('/health', async (_req: Request, res: Response) => {
  // 主動戳一下 Circuit Breaker 更新狀態
  await localRunner.canUseLocal();
  const runnerStatus = localRunner.getStatus();

  // 快速 ping AI Gateway
  let cloudStatus: 'online' | 'offline' = 'offline';
  try {
    const r = await fetch(`${AI_GATEWAY}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (r.ok) cloudStatus = 'online';
  } catch {
    // silent
  }

  // P5-03: Ping Investment Brain (LangGraph service)
  const INVESTMENT_BRAIN_URL = process.env['INVESTMENT_BRAIN_URL'] ?? 'http://localhost:8090';
  let investmentBrainStatus: 'online' | 'offline' = 'offline';
  try {
    const ibRes = await fetch(`${INVESTMENT_BRAIN_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (ibRes.ok) investmentBrainStatus = 'online';
  } catch {
    // silent
  }

  // Ollama VRAM 狀態
  const runningModels = await getRunningModels();
  const totalVramMB = runningModels.reduce((acc, m) => acc + Math.round(m.size_vram / 1024 / 1024), 0);

  // WRQ 統計
  const wrqStats = writeRequestQueue.getStats();

  // AI Cost 摘要
  const costStats = costTracker.getAllStats();
  const totalInferences = costStats.reduce((s, a) => s + a.inference_count, 0);
  const totalTokens = costStats.reduce((s, a) => s + a.total_tokens, 0);

  // P5-03: Rate limiter stats
  const rateLimitStats = getRateLimitStats();

  logger.debug('[System/health] Health check computed');

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    local: {
      ...runnerStatus,
      ollama_url: OLLAMA_BASE,
      models_loaded: runningModels.map(m => ({
        name: m.name,
        vram_mb: Math.round(m.size_vram / 1024 / 1024),
        expires_at: m.expires_at,
      })),
      total_vram_used_mb: totalVramMB,
      vram_budget_mb: 14336,  // 14 GB
      vram_available_mb: 14336 - totalVramMB,
    },
    cloud: {
      status: cloudStatus,
      gateway_url: AI_GATEWAY,
    },
    // P5-03: Investment Brain subsystem
    investment_brain: {
      status: investmentBrainStatus,
      url: INVESTMENT_BRAIN_URL,
    },
    hardware: {
      gpu: 'NVIDIA GeForce RTX 4080 SUPER',
      vram_total_mb: 16376,
      cuda_version: '12.x',
      compute_capability: '8.9',
    },
    agents_summary: {
      total_known: KNOWN_AGENT_COUNT,
      description: 'Poll /system/agent-bus for live status',
    },
    write_request_queue: {
      queued: wrqStats.queued,
      dead_letters: wrqStats.dead_letters,
      processed_keys: wrqStats.processed_keys,
    },
    ai_cost: {
      total_inferences: totalInferences,
      total_tokens: totalTokens,
    },
    // P5-03: Rate limiter active key counts
    rate_limit: rateLimitStats,
  });
});


// ── GET /system/health/deep ───────────────────────────────────
/**
 * @openapi
 * /system/health/deep:
 *   get:
 *     tags: [System]
 *     summary: 系統平行深度健康檢查（P5-03）
 *     description: 並行檢查 Brain, Redis, Gateway 等外部相依服務狀態
 *     responses:
 *       200:
 *         description: 系統各組件健康狀態
 */
systemRouter.get('/health/deep', async (_req: Request, res: Response) => {
  const INVESTMENT_BRAIN_URL = process.env['INVESTMENT_BRAIN_URL'] ?? 'http://localhost:8090';
  const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

  const [brainRes, gatewayRes, redisRes] = await Promise.allSettled([
    fetch(`${INVESTMENT_BRAIN_URL}/health`, { signal: AbortSignal.timeout(2000) }).then(r => r.ok),
    fetch(`${AI_GATEWAY}/health`, { signal: AbortSignal.timeout(2000) }).then(r => r.ok),
    import('ioredis').then(({ default: Redis }) => {
      return new Promise<boolean>((resolve) => {
        const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 0, connectTimeout: 1000 });
        redis.ping()
          .then(() => resolve(true))
          .catch(() => resolve(false))
          .finally(() => redis.disconnect());
      });
    }),
  ]);

  const investmentBrainStatus = brainRes.status === 'fulfilled' && brainRes.value ? 'online' : 'offline';
  const gatewayStatus = gatewayRes.status === 'fulfilled' && gatewayRes.value ? 'online' : 'offline';
  const redisStatus = redisRes.status === 'fulfilled' && redisRes.value ? 'online' : 'offline';

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    components: {
      investment_brain: { status: investmentBrainStatus, url: INVESTMENT_BRAIN_URL },
      ai_gateway: { status: gatewayStatus, url: AI_GATEWAY },
      redis: { status: redisStatus },
      local_runner: localRunner.getStatus(),
    }
  });
});

// ── GET /system/models ────────────────────────────────────────
systemRouter.get('/models', async (_req: Request, res: Response) => {
  // 取得 Ollama 本地可用模型
  let localModels: Array<{ name: string; size_gb: number; parameter_size?: string }> = [];
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) {
      const data = await r.json() as {
        models?: Array<{ name: string; size: number; details?: { parameter_size?: string } }>;
      };
      localModels = (data.models ?? []).map(m => ({
        name: m.name,
        size_gb: Math.round(m.size / 1024 / 1024 / 1024 * 10) / 10,
        parameter_size: m.details?.parameter_size,
      }));
    }
  } catch {
    logger.warn('[System] Ollama /api/tags unreachable');
  }

  res.json({
    local: {
      endpoint: `${OLLAMA_BASE}/v1`,
      models: localModels,
      primary: process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b',
      coder: process.env['OLLAMA_CODER_MODEL'] ?? 'qwen3-coder:30b-a3b',
    },
    cloud: {
      endpoint: `${AI_GATEWAY}/v1`,
      models: [
        { name: 'gemini-2.5-flash', tier: 'primary' },
        { name: 'claude-sonnet-4.6', tier: 'heavy' },
        { name: 'gpt-4o-mini', tier: 'fallback' },
      ],
    },
  });
});
