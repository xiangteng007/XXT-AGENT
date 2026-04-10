/**
 * GET /system/health  — 本地 Ollama + 雲端 Gateway 健康狀態
 * GET /system/models  — 可用模型清單（local + cloud）
 */

import { Router, Request, Response } from 'express';
import { localRunner } from '../local-runner-circuit-breaker';
import { getRunningModels } from '../ollama-inference.service';
import { logger } from '../logger';

export const systemRouter = Router();

const OLLAMA_BASE = process.env['LOCAL_RUNNER_BASE_URL'] ?? 'http://localhost:11434';
const AI_GATEWAY = process.env['AI_GATEWAY_URL'] ?? 'http://localhost:8080';

// ── GET /system/health ────────────────────────────────────────
systemRouter.get('/health', async (_req: Request, res: Response) => {
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

  // Ollama VRAM 狀態
  const runningModels = await getRunningModels();
  const totalVramMB = runningModels.reduce((acc, m) => acc + Math.round(m.size_vram / 1024 / 1024), 0);

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
    hardware: {
      gpu: 'NVIDIA GeForce RTX 4080 SUPER',
      vram_total_mb: 16376,
      cuda_version: '12.x',
      compute_capability: '8.9',
    },
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
