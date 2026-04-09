/**
 * Regulation Route — NemoClaw Layer 4 Gateway Proxy
 *
 * 代理路由：將 OpenClaw Gateway 作為 Regulation RAG 的統一入口
 * 前端 / Telegram Bot / SENTENG ERP 只需調用 Gateway，不直接接觸 RAG Service
 *
 * 支援法規類別（v2.0）：
 *   tax           — 所得稅法、營業稅法、統一發票管理辦法
 *   labor         — 勞動基準法、勞工保險條例、職業安全衛生法
 *   building      — 建築法、建築技術規則、建築師法
 *   fire          — 消防法、各類場所消防安全設備設置標準
 *   cns           — CNS 國家標準（工程相關）
 *   insurance     — 保險法、強制汽車責任保險法
 *   aviation      — 民用航空法、無人機管理規則、特定地區航空器飛行及活動管理辦法   [v2.0 新增]
 *   nonprofit     — 人民團體法、公益勸募條例、志願服務法、社會團體設立規則         [v2.0 新增]
 *   renovation    — 建築法§77-2、室內裝修管理辦法（內政部）                       [v2.0 新增]
 *   ip_creative   — 著作權法（設計著作）、室內設計著作保護                         [v2.0 新增]
 *   real_estate   — 土地稅法、房地合一稅、土地法、地政士法                         [v2.0 新增]
 *
 * 路由：
 *   POST /regulation/query    — 法規語義搜尋
 *   POST /regulation/ask      — RAG + LLM 精心問答
 *   GET  /regulation/health   — RAG Service 健康狀態
 *   GET  /regulation/categories — 所有支援類別清單（含描述）
 *   GET  /regulation/sources  — 各類別法規來源
 */

import { Router, Request, Response } from 'express';
import { logger } from '../logger';
import { regulationSystemPrompt } from '../prompts';

export const regulationRouter = Router();

const RAG_BASE = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';
const RAG_TIMEOUT_MS = parseInt(process.env['REGULATION_TIMEOUT_MS'] ?? '10000', 10);



// ── 通用代理輔助函數 ────────────────────────────────────────────
async function proxyToRag(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${RAG_BASE}${path}`;
  try {
    const resp = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(RAG_TIMEOUT_MS),
    });
    const data = await resp.json().catch(() => ({ error: 'Invalid JSON from RAG' }));
    return { ok: resp.ok, status: resp.status, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[Regulation] RAG proxy error: ${msg} (${url})`);
    return { ok: false, status: 503, data: { error: `RAG service unreachable: ${msg}` } };
  }
}

// ── 支援的法規類別清單 ─────────────────────────────────────────
const REGULATION_CATEGORIES = [
  { code: 'tax',         label_zh: '稅務法規',     description: '所得稅法、營業稅法、統一發票管理辦法', agents: ['accountant'] },
  { code: 'labor',       label_zh: '勞工法規',     description: '勞動基準法、勞工保險條例、職業安全衛生法', agents: ['accountant'] },
  { code: 'building',    label_zh: '建築法規',     description: '建築法、建築技術規則、建築師法', agents: ['bim', 'estimator'] },
  { code: 'fire',        label_zh: '消防法規',     description: '消防法、各類場所消防安全設備設置標準', agents: ['bim'] },
  { code: 'cns',         label_zh: 'CNS 國家標準', description: 'CNS 國家標準（工程相關）', agents: ['estimator'] },
  { code: 'insurance',   label_zh: '保險法規',     description: '保險法、強制汽車責任保險法', agents: ['guardian'] },
  { code: 'aviation',    label_zh: '航空法規',     description: '民用航空法、無人機管理規則、特定地區航空器飛行及活動管理辦法', agents: ['scout'], added: 'v2.0' },
  { code: 'nonprofit',   label_zh: '非營利法規',   description: '人民團體法、公益勸募條例、志願服務法', agents: ['zora'], added: 'v2.0' },
  { code: 'renovation',  label_zh: '室內裝修法規', description: '建築法§77-2、室內裝修管理辦法（內政部）', agents: ['interior', 'lex'], added: 'v2.0' },
  { code: 'ip_creative', label_zh: '著作權法規',   description: '著作權法（設計著作）、室內設計著作保護', agents: ['lex'], added: 'v2.0' },
  { code: 'real_estate', label_zh: '不動產法規',   description: '土地稅法、房地合一稅、土地法、地政士法', agents: ['accountant', 'guardian'], added: 'v2.0' },
];

// ── POST /regulation/query ─────────────────────────────────────
/**
 * 法規語義搜尋
 * Body: { query: string, category?: string, top_k?: number }
 * 支援類別：tax | labor | building | fire | cns | insurance | aviation | nonprofit | renovation | ip_creative | real_estate
 */
regulationRouter.post('/query', async (req: Request, res: Response) => {
  const { query, category, top_k } = req.body as {
    query?: string;
    category?: string;
    top_k?: number;
  };

  if (!query?.trim()) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  // 驗證 category（若提供）
  const validCodes = REGULATION_CATEGORIES.map(c => c.code);
  if (category && !validCodes.includes(category)) {
    res.status(400).json({
      error: `Invalid category: "${category}"`,
      valid_categories: validCodes,
    });
    return;
  }

  logger.info(`[Regulation] query="${query.slice(0, 50)}" category=${category ?? 'all'}`);
  const { ok, status, data } = await proxyToRag('/query', 'POST', { query, category, top_k });
  res.status(ok ? 200 : status).json(data);
});

// ── POST /regulation/ask ──────────────────────────────────────
/**
 * RAG + LLM 精心問答
 * 1. 先向 RAG 搜尋相關法條
 * 2. 將法條作為 context 交給 qwen3:14b 生成完整回答
 * Body: { question: string, category?: string }
 */
regulationRouter.post('/ask', async (req: Request, res: Response) => {
  const { question, category } = req.body as {
    question?: string;
    category?: string;
  };

  if (!question?.trim()) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  const OLLAMA_BASE = process.env['LOCAL_RUNNER_BASE_URL'] ?? 'http://localhost:11434';
  const LLM_MODEL = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';

  // Step 1：RAG 搜尋相關法條
  const ragResult = await proxyToRag('/query', 'POST', {
    query: question,
    category,
    top_k: 4,
  });

  if (!ragResult.ok) {
    res.status(503).json({ error: 'RAG search failed', detail: ragResult.data });
    return;
  }

  const ragData = ragResult.data as {
    results?: Array<{ content: string; source: string; score: number }>;
    latency_ms?: number;
  };
  const chunks = ragData.results ?? [];

  // Step 2：組合 context + 問題，呼叫 qwen3:14b
  const contextText = chunks.length > 0
    ? chunks.map((c, i) =>
        `【法條 ${i + 1}】${c.source}\n${c.content}`
      ).join('\n\n')
    : '（未找到相關法條）';

  const systemPrompt =
    `你是 SENTENG ERP 的法規查詢助理，專精台灣建築、消防、稅務、勞工法規。
以下是相關法條（由向量資料庫搜尋提供）：

${contextText}

請根據以上法條，用繁體中文簡潔回答使用者的問題。
若法條不足以回答，請說明並建議補充查詢方向。
回答格式：
1. 直接回答問題
2. 引用具體條文（如：依建築技術規則第X條）
3. 注意事項（若有）`;

  try {
    const llmResp = await fetch(`${OLLAMA_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        temperature: 0.1,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const llmData = await llmResp.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = llmData.choices?.[0]?.message?.content ?? '無法生成回答';

    res.json({
      question,
      answer,
      sources: chunks.map(c => ({ source: c.source, score: c.score })),
      rag_latency_ms: ragData.latency_ms,
      model: LLM_MODEL,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Regulation/ask] LLM error: ${msg}`);
    // 降級：只回傳 RAG 結果
    res.status(200).json({
      question,
      answer: `（LLM 暫時不可用）以下為相關法條：\n\n${contextText}`,
      sources: chunks.map(c => ({ source: c.source, score: c.score })),
      rag_only: true,
    });
  }
});

// ── GET /regulation/health ─────────────────────────────────────
regulationRouter.get('/health', async (_req: Request, res: Response) => {
  const { ok, data } = await proxyToRag('/health', 'GET');
  res.status(ok ? 200 : 503).json({
    rag_service: ok ? 'online' : 'offline',
    rag_url: RAG_BASE,
    ...(data as object),
  });
});

// ── GET /regulation/categories ────────────────────────────────
/**
 * 回傳 Gateway 自身定義的類別清單（不依賴 RAG 服務）
 * 若 RAG 服務在線，同時回傳 RAG 內的實際分類以供比對
 */
regulationRouter.get('/categories', async (_req: Request, res: Response) => {
  // Gateway 自身定義的類別（不依賴 RAG 服務健康狀態）
  const gatewayCategories = REGULATION_CATEGORIES;

  // 嘗試向 RAG 取得實際存入的類別
  const { ok, data } = await proxyToRag('/categories', 'GET');

  res.json({
    gateway_categories: gatewayCategories,
    rag_categories:     ok ? data : null,
    rag_online:         ok,
    note:               'gateway_categories 是 Gateway 宣告支援的類別；rag_categories 是 RAG 服務實際已建立索引的類別',
  });
});

// ── GET /regulation/sources ───────────────────────────────────
regulationRouter.get('/sources', async (req: Request, res: Response) => {
  const category = req.query['category'] as string | undefined;
  const path = category ? `/sources?category=${category}` : '/sources';
  const { ok, data } = await proxyToRag(path, 'GET');
  res.status(ok ? 200 : 503).json(data);
});
