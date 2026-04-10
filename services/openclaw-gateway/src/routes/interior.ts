/**
 * Lumi Interior Design Agent Route — 完整實作 (D-02)
 *
 * POST /agents/interior/chat        — 室內設計自由問答（RAG 支援）
 * POST /agents/interior/project     — 新增裝修專案
 * GET  /agents/interior/project     — 查詢專案清單
 * POST /agents/interior/material    — 材質/家具建議查詢
 * GET  /agents/interior/health      — Agent 健康狀態
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../logger';
import { agentChat } from '../inference-wrapper';
import { interiorSystemPrompt } from '../prompts';

export const interiorRouter = Router();

const REGULATION_RAG_URL = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';
const AGENT_ID = 'lumi';



// In-memory 裝修專案
const PROJECTS: DesignProject[] = [];

interface DesignProject {
  project_id: string;
  project_name: string;
  space_type: 'residential' | 'commercial' | 'office' | 'medical' | 'hospitality' | 'other';
  total_sqm: number;
  style: string;            // e.g. 現代簡約、日式侘寂、工業風
  budget_twd?: number;
  client_name: string;
  status: 'design' | 'approval' | 'construction' | 'completed';
  notes?: string;
  created_at: string;
}

async function queryRenovationRag(question: string): Promise<string> {
  try {
    const resp = await fetch(`${REGULATION_RAG_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, category: 'renovation', top_k: 3 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return '';
    const data = await resp.json() as { results?: Array<{ content: string; source: string }> };
    return (data.results ?? []).map(r => `【${r.source}】\n${r.content}`).join('\n\n---\n\n');
  } catch { return ''; }
}

// ── POST /agents/interior/chat ─────────────────────────────────
interiorRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, session_id } = req.body as { message?: string; session_id?: string };
  if (!message?.trim()) { res.status(400).json({ error: 'message is required' }); return; }

  const ragContext = await queryRenovationRag(message);
  const systemPrompt = ragContext
    ? `${interiorSystemPrompt.template}\n\n【相關裝修法規（RAG）】\n${ragContext}`
    : interiorSystemPrompt.template;

  const result = await agentChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ], { agentId: AGENT_ID, action: 'INTERIOR_CHAT', sessionId: session_id, temperature: 0.3 });

  res.json({
    agent: AGENT_ID,
    session_id: session_id ?? crypto.randomUUID(),
    answer: result.content,
    latency_ms: result.latency_ms,
    rag_used: !!ragContext,
  });
});

// ── POST /agents/interior/project ─────────────────────────────
interiorRouter.post('/project', async (req: Request, res: Response) => {
  const body = req.body as Partial<DesignProject>;
  if (!body.project_name || !body.client_name || !body.total_sqm) {
    res.status(400).json({ error: 'project_name, client_name, total_sqm are required' }); return;
  }
  const project: DesignProject = {
    project_id:   crypto.randomUUID(),
    project_name: body.project_name,
    space_type:   body.space_type ?? 'residential',
    total_sqm:    body.total_sqm,
    style:        body.style ?? '現代簡約',
    budget_twd:   body.budget_twd,
    client_name:  body.client_name,
    status:       'design',
    notes:        body.notes,
    created_at:   new Date().toISOString(),
  };
  PROJECTS.push(project);
  logger.info(`[Lumi] Design project created: ${project.project_id} | ${project.project_name}`);
  res.status(201).json({ project_id: project.project_id, project_name: project.project_name });
});

// ── GET /agents/interior/project ───────────────────────────────
interiorRouter.get('/project', async (_req: Request, res: Response) => {
  res.json({ total: PROJECTS.length, projects: PROJECTS });
});

// ── POST /agents/interior/material ────────────────────────────
interiorRouter.post('/material', async (req: Request, res: Response) => {
  const { space_type, style, budget_per_sqm } = req.body as {
    space_type?: string; style?: string; budget_per_sqm?: number;
  };

  const prompt = `針對「${space_type ?? '住宅'}」空間，風格為「${style ?? '現代簡約'}」
${budget_per_sqm ? `，每坪預算約 NT$${budget_per_sqm.toLocaleString()}` : ''}，
請推薦適合的：
1. 地板材質（含優缺點）
2. 牆面處理方式
3. 天花板設計
4. 主要照明形式
每項建議請附上參考單價（NT$/坪 或 NT$/m²）並標注 ⚠️(建議向 Rusty 確認實際工程報價)。`;

  const result = await agentChat([
    { role: 'system', content: interiorSystemPrompt.template },
    { role: 'user', content: prompt },
  ], { agentId: AGENT_ID, action: 'MATERIAL_SUGGEST', temperature: 0.2 });

  res.json({
    agent: AGENT_ID,
    query: { space_type, style, budget_per_sqm },
    suggestions: result.content,
    disclaimer: '⚠️ 建議單價為市場參考值，實際工程費用請向 Rusty (Estimator) 確認',
  });
});

// ── GET /agents/interior/health ────────────────────────────────
interiorRouter.get('/health', async (_req: Request, res: Response) => {
  res.json({
    agent: AGENT_ID,
    status: 'online',
    entity_scope: 'co_design',
    stats: { total_projects: PROJECTS.length },
    timestamp: new Date().toISOString(),
  });
});
