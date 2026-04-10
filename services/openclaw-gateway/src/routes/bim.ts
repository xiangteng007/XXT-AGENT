/**
 * Titan BIM Agent Route — 完整實作 (D-01)
 *
 * POST /agents/bim/chat          — 結構/BIM 自由問答（RAG 支援）
 * POST /agents/bim/model         — 新增 BIM 模型紀錄
 * GET  /agents/bim/model         — 查詢模型清單
 * POST /agents/bim/collision     — 提交碰撞檢測任務
 * GET  /agents/bim/health        — Agent 健康狀態
 *
 * 設計原則：
 *   - 推理走本地 Ollama (qwen3:14b) — 建築機密不出境
 *   - 建築法規查詢走 /regulation RAG (building)
 *   - 碰撞報告結果通知 Rusty 估算修改費用
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../logger';
import { agentChat } from '../inference-wrapper';
import { bimSystemPrompt } from '../prompts';

export const bimRouter = Router();

const REGULATION_RAG_URL = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';
const AGENT_ID = 'titan';



// In-memory BIM 模型記錄（輕量用途）
const MODELS: BimModel[] = [];
const COLLISIONS: CollisionTask[] = [];

interface BimModel {
  model_id: string;
  project_name: string;
  version: string;
  discipline: 'architecture' | 'structure' | 'mep' | 'combined';
  floor_count: number;
  total_area_sqm?: number;
  software: 'revit' | 'archicad' | 'tekla' | 'other';
  file_format: 'rvt' | 'ifc' | 'nwc' | 'other';
  created_at: string;
  notes?: string;
}

interface CollisionTask {
  task_id: string;
  model_id: string;
  disciplines: string[];
  collision_count?: number;
  hard_collisions?: number;   // 硬碰撞（管線穿牆）
  soft_collisions?: number;   // 軟碰撞（淨高不足）
  status: 'pending' | 'processing' | 'completed';
  result_summary?: string;
  created_at: string;
}

async function queryBuildingRag(question: string): Promise<string> {
  try {
    const resp = await fetch(`${REGULATION_RAG_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, category: 'building', top_k: 4 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return '';
    const data = await resp.json() as { results?: Array<{ content: string; source: string }> };
    return (data.results ?? []).map(r => `【${r.source}】\n${r.content}`).join('\n\n---\n\n');
  } catch { return ''; }
}

// ── POST /agents/bim/chat ──────────────────────────────────────
bimRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, session_id } = req.body as { message?: string; session_id?: string };
  if (!message?.trim()) { res.status(400).json({ error: 'message is required' }); return; }

  const ragContext = await queryBuildingRag(message);
  const systemPrompt = ragContext
    ? `${bimSystemPrompt.template}\n\n【相關建築法規（RAG）】\n${ragContext}`
    : bimSystemPrompt.template;

  const result = await agentChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ], { agentId: AGENT_ID, action: 'BIM_CHAT', sessionId: session_id, temperature: 0.15 });

  res.json({
    agent: AGENT_ID,
    session_id: session_id ?? crypto.randomUUID(),
    answer: result.content,
    latency_ms: result.latency_ms,
    rag_used: !!ragContext,
  });
});

// ── POST /agents/bim/model ─────────────────────────────────────
bimRouter.post('/model', async (req: Request, res: Response) => {
  const body = req.body as Partial<BimModel>;
  if (!body.project_name || !body.discipline) {
    res.status(400).json({ error: 'project_name, discipline are required' }); return;
  }
  const model: BimModel = {
    model_id:       crypto.randomUUID(),
    project_name:   body.project_name,
    version:        body.version ?? '1.0',
    discipline:     body.discipline,
    floor_count:    body.floor_count ?? 1,
    total_area_sqm: body.total_area_sqm,
    software:       body.software ?? 'revit',
    file_format:    body.file_format ?? 'rvt',
    created_at:     new Date().toISOString(),
    notes:          body.notes,
  };
  MODELS.push(model);
  logger.info(`[Titan] BIM model created: ${model.model_id} | ${model.project_name}`);
  res.status(201).json({ model_id: model.model_id, project_name: model.project_name });
});

// ── GET /agents/bim/model ──────────────────────────────────────
bimRouter.get('/model', async (_req: Request, res: Response) => {
  res.json({ total: MODELS.length, models: MODELS });
});

// ── POST /agents/bim/collision ─────────────────────────────────
bimRouter.post('/collision', async (req: Request, res: Response) => {
  const { model_id, disciplines = ['architecture', 'structure', 'mep'],
    collision_count, hard_collisions, soft_collisions } = req.body as {
    model_id?: string;
    disciplines?: string[];
    collision_count?: number;
    hard_collisions?: number;
    soft_collisions?: number;
  };

  const task: CollisionTask = {
    task_id: crypto.randomUUID(),
    model_id: model_id ?? 'unknown',
    disciplines,
    collision_count,
    hard_collisions,
    soft_collisions,
    status: collision_count !== undefined ? 'completed' : 'pending',
    created_at: new Date().toISOString(),
  };

  if (task.status === 'completed') {
    task.result_summary = `共發現 ${collision_count ?? 0} 個碰撞（硬碰撞 ${hard_collisions ?? 0} 個，軟碰撞 ${soft_collisions ?? 0} 個）`;
  }

  COLLISIONS.push(task);

  const response: Record<string, unknown> = {
    task_id: task.task_id,
    status: task.status,
    result_summary: task.result_summary,
  };

  if ((hard_collisions ?? 0) > 0) {
    response['rusty_notification'] = '⚠️ 已記錄硬碰撞，建議通知 Rusty (Estimator) 評估修改費用';
    response['rusty_endpoint'] = 'POST /agents/estimator/chat 說明碰撞位置與修改範圍';
  }

  res.status(201).json(response);
});

// ── GET /agents/bim/health ─────────────────────────────────────
bimRouter.get('/health', async (_req: Request, res: Response) => {
  res.json({
    agent: AGENT_ID,
    status: 'online',
    entity_scope: 'co_build,co_design',
    stats: { total_models: MODELS.length, total_collision_tasks: COLLISIONS.length },
    timestamp: new Date().toISOString(),
  });
});
