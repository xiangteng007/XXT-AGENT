/**
 * Rusty Estimator Agent Route — 完整實作 (D-03)
 *
 * POST /agents/estimator/chat        — 算量/估價自由問答
 * POST /agents/estimator/bom         — 新增 BOM 材料單
 * GET  /agents/estimator/bom         — 查詢 BOM 清單
 * POST /agents/estimator/quote       — 工程報價試算
 * GET  /agents/estimator/health      — Agent 健康狀態
 *
 * 設計原則：
 *   - 推理走本地 Ollama（工程報價含商業機密）
 *   - CNS 鋼筋標準查詢走 RAG
 *   - 報價完成後通知 Lex 是否需要啟動合約草擬
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../logger';
import { agentChat } from '../inference-wrapper';
import { estimatorSystemPrompt } from '../prompts';

export const estimatorRouter = Router();

const REGULATION_RAG_URL = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';
const GATEWAY_BASE        = process.env['GATEWAY_INTERNAL_URL'] ?? 'http://localhost:3100';
const AGENT_ID = 'rusty';



// In-memory BOM 記錄
const BOMS: BomRecord[] = [];

interface BomItem {
  item_no:     string;
  description: string;
  unit:        string;
  quantity:    number;
  unit_price:  number;    // NT$
  total:       number;
  cns_ref?:    string;    // CNS 規範編號
}

interface BomRecord {
  bom_id:      string;
  project_name: string;
  category:    'structure' | 'architecture' | 'mep' | 'exterior' | 'interior' | 'other';
  items:       BomItem[];
  subtotal:    number;
  tax_rate:    number;   // %
  total_taxed: number;
  created_at:  string;
  notes?:      string;
}

async function queryCnsRag(question: string): Promise<string> {
  try {
    const resp = await fetch(`${REGULATION_RAG_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, category: 'building', top_k: 3 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return '';
    const data = await resp.json() as { results?: Array<{ content: string; source: string }> };
    return (data.results ?? []).map(r => `【${r.source}】\n${r.content}`).join('\n\n---\n\n');
  } catch { return ''; }
}

// ── POST /agents/estimator/chat ────────────────────────────────
estimatorRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, session_id } = req.body as { message?: string; session_id?: string };
  if (!message?.trim()) { res.status(400).json({ error: 'message is required' }); return; }

  const ragContext = await queryCnsRag(message);
  const systemPrompt = ragContext
    ? `${estimatorSystemPrompt.template}\n\n【相關 CNS/建築規範（RAG）】\n${ragContext}`
    : estimatorSystemPrompt.template;

  const result = await agentChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ], { agentId: AGENT_ID, action: 'ESTIMATOR_CHAT', sessionId: session_id, temperature: 0.1 });

  res.json({
    agent: AGENT_ID,
    session_id: session_id ?? crypto.randomUUID(),
    answer: result.content,
    latency_ms: result.latency_ms,
    rag_used: !!ragContext,
  });
});

// ── POST /agents/estimator/bom ─────────────────────────────────
estimatorRouter.post('/bom', async (req: Request, res: Response) => {
  const { project_name, category = 'other', items = [], tax_rate = 5, notes } = req.body as {
    project_name?: string;
    category?: BomRecord['category'];
    items?: Array<Omit<BomItem, 'total'>>;
    tax_rate?: number;
    notes?: string;
  };

  if (!project_name || items.length === 0) {
    res.status(400).json({ error: 'project_name and items[] are required' }); return;
  }

  const computedItems: BomItem[] = items.map((i, idx) => ({
    ...i,
    item_no: i.item_no ?? String(idx + 1).padStart(3, '0'),
    total: Math.round(i.quantity * i.unit_price),
  }));

  const subtotal = computedItems.reduce((s, i) => s + i.total, 0);
  const taxAmount = Math.round(subtotal * tax_rate / 100);
  const total_taxed = subtotal + taxAmount;

  const bom: BomRecord = {
    bom_id: crypto.randomUUID(),
    project_name, category,
    items: computedItems,
    subtotal, tax_rate, total_taxed,
    created_at: new Date().toISOString(),
    notes,
  };

  BOMS.push(bom);
  logger.info(`[Rusty] BOM created: ${bom.bom_id} | NT$${total_taxed.toLocaleString()}`);

  res.status(201).json({
    bom_id: bom.bom_id,
    project_name,
    item_count: computedItems.length,
    subtotal,
    tax_amount: taxAmount,
    total_taxed,
    lex_notice: total_taxed > 500000
      ? '⚠️ 報價金額超過 NT$500K，建議通知 Lex (合約管家) 簽訂正式採購合約'
      : null,
  });
});

// ── GET /agents/estimator/bom ──────────────────────────────────
estimatorRouter.get('/bom', async (req: Request, res: Response) => {
  const { category, limit } = req.query as { category?: string; limit?: string };
  let results = [...BOMS];
  if (category) results = results.filter(b => b.category === category);
  const lim = Math.min(parseInt(limit ?? '50'), 200);
  results = results.slice(-lim).reverse();
  const total_value = results.reduce((s, b) => s + b.total_taxed, 0);
  res.json({ total: results.length, total_value, boms: results });
});

// ── POST /agents/estimator/quote ───────────────────────────────
estimatorRouter.post('/quote', async (req: Request, res: Response) => {
  const { project_name, work_type, area_sqm, description, client_name } = req.body as {
    project_name?: string;
    work_type: 'structure' | 'waterproof' | 'tile' | 'paint' | 'electrical' | 'plumbing' | 'other';
    area_sqm?: number;
    description?: string;
    client_name?: string;
  };

  // 2024 工種參考費率（NT$/m²，含工料不含稅）
  const RATES: Record<string, { min: number; max: number; unit: string }> = {
    structure:   { min: 18000, max: 28000, unit: 'm²' },
    waterproof:  { min: 800,   max: 1500,  unit: 'm²' },
    tile:        { min: 2500,  max: 5000,  unit: 'm²' },
    paint:       { min: 300,   max: 800,   unit: 'm²' },
    electrical:  { min: 2000,  max: 4000,  unit: 'm²' },
    plumbing:    { min: 1500,  max: 3000,  unit: 'm²' },
    other:       { min: 1000,  max: 3000,  unit: 'm²' },
  };

  const rate = RATES[work_type] ?? RATES.other;
  const sqm = area_sqm ?? 100;

  const subtotal_min = Math.round(rate.min * sqm);
  const subtotal_max = Math.round(rate.max * sqm);

  res.json({
    quote_id:     crypto.randomUUID(),
    project_name: project_name ?? '未命名專案',
    client_name:  client_name ?? '待填',
    work_type,
    area_sqm:     sqm,
    rate_range:   `NT$${rate.min.toLocaleString()} ~ NT$${rate.max.toLocaleString()} / ${rate.unit}`,
    estimate: {
      min: subtotal_min,
      max: subtotal_max,
      tax_5pct_min: Math.round(subtotal_min * 1.05),
      tax_5pct_max: Math.round(subtotal_max * 1.05),
    },
    note: '⚠️ 此為概估範圍，正式報價需依實際圖面丈量，並由 Lex 核簽採購合約',
    generated_at: new Date().toISOString(),
  });
});

// ── GET /agents/estimator/health ───────────────────────────────
estimatorRouter.get('/health', async (_req: Request, res: Response) => {
  res.json({
    agent: AGENT_ID,
    status: 'online',
    entity_scope: 'co_build,co_design',
    stats: { total_boms: BOMS.length },
    timestamp: new Date().toISOString(),
  });
});
