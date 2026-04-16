/**
 * Lex Agent Route — 合約管家
 *
 * 跨所有法人實體（C1-C4, A1）的合約電子化、版本管理、文書中樞：
 *
 * POST /agents/lex/chat             — 自由問答（合約法律/條款分析）
 *
 * POST /agents/lex/contract         — 新增合約
 * GET  /agents/lex/contract         — 查詢合約清單
 * GET  /agents/lex/contract/:id     — 合約詳情
 * PATCH /agents/lex/contract/:id/status — 更新合約狀態
 * POST /agents/lex/contract/:id/analyze — AI 條款風險分析
 *
 * GET  /agents/lex/contract/expiring — 即將到期合約警示
 * GET  /agents/lex/contract/milestones — 所有進行中合約的付款節點
 *
 * POST /agents/lex/document         — 新增文件（DocHub）
 * GET  /agents/lex/document         — 查詢文件清單
 * GET  /agents/lex/document/expiring — 即將到期文件（執照/保單）
 *
 * GET  /agents/lex/report/monthly   — 月度合約彙整
 * GET  /agents/lex/health           — Agent 狀態
 *
 * 設計原則：
 *   - 推理強制本地（qwen3:14b，合約含高度商業機密）
 *   - 合約請款節點完成後 Write Request 至鳴鑫
 *   - 法條驗證呼叫 /regulation RAG（多類別）
 *   - 每份合約有完整生命週期追蹤
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../logger';
import { agentChat } from '../inference-wrapper';
import type { EntityType } from '../entity';
import { lexSystemPrompt } from '../prompts';

export const lexRouter = Router();

const REGULATION_RAG_URL = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';
const GATEWAY_BASE        = process.env['GATEWAY_INTERNAL_URL'] ?? 'http://localhost:3100';
const AGENT_ID            = 'lex';
const MODEL               = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';


// ── In-memory Stores ──────────────────────────────────────────
const CONTRACTS: Contract[] = [];
const DOCUMENTS: DocHubItem[] = [];
const MAX = 1000;

// ── 型別定義 ─────────────────────────────────────────────────────

type ContractType    = 'owner' | 'subcontract' | 'design' | 'service' | 'purchase' | 'lease' | 'nda' | 'other';
type ContractStatus  = 'draft' | 'review' | 'active' | 'completed' | 'disputed' | 'terminated';

interface PaymentMilestone {
  milestone_id:  string;
  label:         string;   // e.g. '簽約款 30%'
  due_date:      string;
  amount:        number;
  percentage?:   number;
  is_paid:       boolean;
  paid_date?:    string;
}

interface Contract {
  contract_id:     string;
  entity_type:     EntityType;
  contract_type:   ContractType;
  title:           string;
  counterparty:    string;
  counterparty_tax_id?: string;
  total_amount:    number;   // NT$
  currency:        'NTD' | 'USD' | 'other';
  sign_date:       string;
  effective_date:  string;
  expiry_date?:    string;
  status:          ContractStatus;
  milestones:      PaymentMilestone[];
  // 關鍵條款
  warranty_months?:    number;   // 保固期（月）
  liability_cap?:      number;   // 責任上限（NT$）
  penalty_clause?:     string;   // 違約罰則說明
  // 關聯
  project_id?:         string;
  related_contract_id?: string;  // 業主合約 ↔ 分包合約
  // 文件
  file_ref?:           string;   // 文件 ID（DocHub）
  notes?:              string;
  created_at:          string;
  updated_at:          string;
}

type DocCategory = 'business_license' | 'permit' | 'insurance_policy' | 'certification' | 'design_doc' | 'contract_file' | 'correspondence' | 'other';

interface DocHubItem {
  doc_id:       string;
  entity_type:  EntityType;
  category:     DocCategory;
  title:        string;
  issuer?:      string;
  issue_date?:  string;
  expiry_date?: string;
  doc_no?:      string;
  file_ref?:    string;   // 實際檔案路徑/URL（加密儲存）
  notes?:       string;
  created_at:   string;
}

// ── 工具函數 ─────────────────────────────────────────────────────

function now(): string { return new Date().toISOString(); }

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (24 * 3600 * 1000));
}

/** 查詢合約相關法規 RAG（多類別）*/
async function queryContractRag(question: string, category?: string): Promise<string> {
  const cats = category ? [category] : ['tax', 'building', 'renovation', 'aviation', 'nonprofit'];
  let results = '';
  for (const cat of cats) {
    try {
      const resp = await fetch(`${REGULATION_RAG_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question, category: cat, top_k: 2 }),
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) continue;
      const data = await resp.json() as { results?: Array<{ content: string; source: string }> };
      for (const r of data.results ?? []) {
        results += `【${r.source}】\n${r.content}\n\n`;
      }
    } catch { continue; }
  }
  return results.trim();
}

/** Write Request → 鳴鑫（里程碑付款）— QVP 佇列化版 */
async function notifyAccountant(
  contract: Contract,
  milestone: PaymentMilestone,
): Promise<void> {
  const { writeRequestQueue } = await import('../write-request-queue');

  // 冪等性金鑰：合約 ID + 里程碑 ID（天然唯一）
  const idempotencyKey = `lex_milestone_${contract.contract_id}_${milestone.milestone_id}`;

  const result = await writeRequestQueue.submit({
    source_agent:    'lex',
    target_agent:    'accountant',
    collection:      'accountant_ledger',
    operation:       'create',
    idempotency_key: idempotencyKey,
    entity_type:     contract.entity_type,
    reason:          `Lex 合約里程碑付款入帳：${milestone.label}`,
    data: {
      type: 'income',
      category: contract.contract_type === 'design' ? 'design_fee' : 'engineering_payment',
      description: `合約收款：${contract.title} — ${milestone.label}`,
      amount_taxed: Math.round(milestone.amount * 1.05),
      amount_untaxed: milestone.amount,
      tax_amount: Math.round(milestone.amount * 0.05),
      tax_rate: 5,
      is_tax_exempt: false,
      entity_type: contract.entity_type,
      counterparty_name: contract.counterparty,
      counterparty_tax_id: contract.counterparty_tax_id,
      transaction_date: milestone.paid_date ?? now().slice(0, 10),
      notes: `合約 ${contract.contract_id} | 里程碑 ${milestone.milestone_id}`,
    },
  });

  if (!result.ok) {
    logger.warn(`[Lex] Write request to accountant failed: ${result.message}`);
  } else {
    logger.info(`[Lex] Milestone payment queued: ${result.request_id} (${result.status})`);
  }
}

// ── POST /agents/lex/chat ──────────────────────────────────────
/**
 * @openapi
 * /agents/lex/chat:
 *   post:
 *     tags: [Lex (合約)]
 *     summary: 合約法律諮詢問答（AI）
 *     description: 與 Lex 進行合約條款分析、風險評估、法規諮詢，支援多類別法規 RAG
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, example: '分包合約需注意哪些遁約風險？' }
 *               entity_type: { type: string }
 *               session_id: { type: string }
 *     responses:
 *       200:
 *         description: AI 回覆
 */
lexRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, session_id, entity_type } = req.body as {
    message?: string;
    session_id?: string;
    entity_type?: EntityType;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const ragContext = await queryContractRag(message);
  const systemPrompt = ragContext
    ? `${lexSystemPrompt.template}\n\n【相關法規（RAG）】\n${ragContext}`
    : lexSystemPrompt.template;

  const contextNote = entity_type
    ? `\n\n【當前實體】${entity_type} — 請依此實體的業務性質回答。`
    : '';

  const result = await agentChat([
    { role: 'system', content: systemPrompt + contextNote },
    { role: 'user', content: message },
  ], { agentId: AGENT_ID, action: 'LEX_CHAT', sessionId: session_id, temperature: 0.1 });

  res.json({
    agent: AGENT_ID,
    session_id: session_id ?? crypto.randomUUID(),
    answer: result.content,
    latency_ms: result.latency_ms,
    rag_used: !!ragContext,
  });
});

// ── POST /agents/lex/contract ─────────────────────────────────
/**
 * @openapi
 * /agents/lex/contract:
 *   post:
 *     tags: [Lex (合約)]
 *     summary: 新增合約
 *     description: 建立合約記錄，支援自動生成付款里程碑，到期警示自動分析
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, entity_type, counterparty, total_amount]
 *             properties:
 *               title: { type: string, example: '台北廠房工程主包合約' }
 *               entity_type: { type: string }
 *               counterparty: { type: string }
 *               contract_type: { type: string, enum: [owner, subcontract, design, service, purchase, lease, nda, other] }
 *               total_amount: { type: number, example: 5000000 }
 *               sign_date: { type: string, format: date }
 *               effective_date: { type: string, format: date }
 *               expiry_date: { type: string, format: date }
 *               milestone_labels: { type: array, items: { type: string } }
 *               milestone_percentages: { type: array, items: { type: number } }
 *     responses:
 *       201:
 *         description: 合約建立成功
 *   get:
 *     tags: [Lex (合約)]
 *     summary: 查詢合約清單
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: entity_type
 *         schema: { type: string }
 *       - in: query
 *         name: contract_type
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, review, active, completed, disputed, terminated] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: 合約清單（含合約總金額）
 */
lexRouter.post('/contract', async (req: Request, res: Response) => {
  const body = req.body as Partial<Contract> & {
    milestone_labels?: string[];
    milestone_percentages?: number[];
  };

  if (!body.title || !body.entity_type || !body.counterparty || !body.total_amount) {
    res.status(400).json({ error: 'title, entity_type, counterparty, total_amount are required' });
    return;
  }

  // 自動生成付款里程碑（若提供）
  const milestones: PaymentMilestone[] = [];
  if (body.milestones && body.milestones.length > 0) {
    milestones.push(...body.milestones);
  } else if (body.milestone_labels && body.milestone_percentages) {
    for (let i = 0; i < body.milestone_labels.length; i++) {
      const pct = body.milestone_percentages[i] ?? 0;
      milestones.push({
        milestone_id: crypto.randomUUID(),
        label:        body.milestone_labels[i] ?? `里程碑 ${i + 1}`,
        due_date:     body.expiry_date ?? body.effective_date ?? now().slice(0, 10),
        amount:       Math.round(body.total_amount * pct / 100),
        percentage:   pct,
        is_paid:      false,
      });
    }
  }

  const contract: Contract = {
    contract_id:     crypto.randomUUID(),
    entity_type:     body.entity_type,
    contract_type:   body.contract_type ?? 'owner',
    title:           body.title,
    counterparty:    body.counterparty,
    counterparty_tax_id: body.counterparty_tax_id,
    total_amount:    body.total_amount,
    currency:        body.currency ?? 'NTD',
    sign_date:       body.sign_date ?? now().slice(0, 10),
    effective_date:  body.effective_date ?? now().slice(0, 10),
    expiry_date:     body.expiry_date,
    status:          'active',
    milestones,
    warranty_months: body.warranty_months,
    liability_cap:   body.liability_cap,
    penalty_clause:  body.penalty_clause,
    project_id:      body.project_id,
    related_contract_id: body.related_contract_id,
    file_ref:        body.file_ref,
    notes:           body.notes,
    created_at:      now(),
    updated_at:      now(),
  };

  if (CONTRACTS.length >= MAX) CONTRACTS.shift();
  CONTRACTS.push(contract);

  // 到期警示計算
  const expiryWarning = contract.expiry_date
    ? daysUntil(contract.expiry_date) < 30
      ? `⚠️ 合約將於 ${daysUntil(contract.expiry_date)} 天後到期（${contract.expiry_date}），請儘速安排續約或收尾。`
      : null
    : null;

  res.status(201).json({
    contract_id:    contract.contract_id,
    status:         contract.status,
    milestones:     milestones.length,
    expiry_warning: expiryWarning,
  });
});

// ── GET /agents/lex/contract ──────────────────────────────────
lexRouter.get('/contract', async (req: Request, res: Response) => {
  const { entity_type, contract_type, status, limit } = req.query as Record<string, string>;

  let results = [...CONTRACTS];
  if (entity_type)   results = results.filter(c => c.entity_type === entity_type);
  if (contract_type) results = results.filter(c => c.contract_type === contract_type);
  if (status)        results = results.filter(c => c.status === status);

  const lim = Math.min(parseInt(limit ?? '50'), 200);
  results = results.slice(-lim).reverse();

  res.json({
    total: results.length,
    total_value: results.reduce((s, c) => s + c.total_amount, 0),
    contracts: results.map(c => ({
      contract_id:    c.contract_id,
      entity_type:    c.entity_type,
      contract_type:  c.contract_type,
      title:          c.title,
      counterparty:   c.counterparty,
      total_amount:   c.total_amount,
      expiry_date:    c.expiry_date,
      status:         c.status,
      days_to_expiry: c.expiry_date ? daysUntil(c.expiry_date) : null,
      unpaid_milestones: c.milestones.filter(m => !m.is_paid).length,
    })),
  });
});

// ── GET /agents/lex/contract/expiring ────────────────────────
/**
 * @openapi
 * /agents/lex/contract/expiring:
 *   get:
 *     tags: [Lex (合約)]
 *     summary: 即將到期合約警示
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: within_days
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: 即將到期合約清單
 */
lexRouter.get('/contract/expiring', async (req: Request, res: Response) => {
  const { within_days } = req.query as { within_days?: string };
  const days = parseInt(within_days ?? '30');

  const expiring = CONTRACTS
    .filter(c => c.expiry_date && c.status === 'active')
    .filter(c => {
      const d = daysUntil(c.expiry_date!);
      return d >= 0 && d <= days;
    })
    .map(c => ({
      contract_id:   c.contract_id,
      title:         c.title,
      entity_type:   c.entity_type,
      counterparty:  c.counterparty,
      expiry_date:   c.expiry_date,
      days_left:     daysUntil(c.expiry_date!),
      total_amount:  c.total_amount,
    }))
    .sort((a, b) => a.days_left - b.days_left);

  res.json({ within_days: days, expiring_count: expiring.length, contracts: expiring });
});

// ── GET /agents/lex/contract/milestones ──────────────────────
/**
 * @openapi
 * /agents/lex/contract/milestones:
 *   get:
 *     tags: [Lex (合約)]
 *     summary: 所有未付付款里程碑
 *     description: 列出所有進行中合約的未付付款里程碑，依到期日排序
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: 未付里程碑清單（含逃期數量）
 */
lexRouter.get('/contract/milestones', async (req: Request, res: Response) => {
  const unpaidMilestones: Array<{
    contract_id: string; title: string; entity_type: string;
    milestone: PaymentMilestone; counterparty: string;
  }> = [];

  for (const c of CONTRACTS.filter(c => c.status === 'active')) {
    for (const m of c.milestones.filter(m => !m.is_paid)) {
      unpaidMilestones.push({
        contract_id: c.contract_id,
        title:       c.title,
        entity_type: c.entity_type,
        counterparty: c.counterparty,
        milestone:   m,
      });
    }
  }

  unpaidMilestones.sort((a, b) =>
    new Date(a.milestone.due_date).getTime() - new Date(b.milestone.due_date).getTime(),
  );

  const overdueItems = unpaidMilestones.filter(i => daysUntil(i.milestone.due_date) < 0);
  const totalUnpaid  = unpaidMilestones.reduce((s, i) => s + i.milestone.amount, 0);

  res.json({
    total_unpaid_milestones: unpaidMilestones.length,
    overdue_count:           overdueItems.length,
    total_unpaid_amount:     totalUnpaid,
    milestones:              unpaidMilestones,
  });
});

// ── PATCH /agents/lex/contract/:id/status ───────────────────
/**
 * @openapi
 * /agents/lex/contract/{id}/status:
 *   patch:
 *     tags: [Lex (合約)]
 *     summary: 更新合約狀態 / 標記里程碑付款
 *     description: 可更新合約狀態或標記特定里程碑為已付，里程碑付款後自動通知鳴鑫入帳
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [draft, review, active, completed, disputed, terminated] }
 *               milestone_id: { type: string, format: uuid }
 *               paid_date: { type: string, format: date }
 *     responses:
 *       200:
 *         description: 合約狀態已更新
 *       404:
 *         description: 合約不存在
 */
lexRouter.patch('/contract/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { status, milestone_id, paid_date } = req.body as {
    status?: ContractStatus;
    milestone_id?: string;
    paid_date?: string;
  };

  const contract = CONTRACTS.find(c => c.contract_id === id);
  if (!contract) {
    res.status(404).json({ error: 'Contract not found' });
    return;
  }

  if (status) contract.status = status;

  // 標記里程碑為已付款
  if (milestone_id) {
    const milestone = contract.milestones.find(m => m.milestone_id === milestone_id);
    if (milestone && !milestone.is_paid) {
      milestone.is_paid   = true;
      milestone.paid_date = paid_date ?? now().slice(0, 10);
      await notifyAccountant(contract, milestone);
    }
  }

  contract.updated_at = now();

  res.json({
    contract_id: id,
    status:      contract.status,
    message:     milestone_id ? '里程碑已標記完成，已通知鳴鑫記帳' : '合約狀態已更新',
  });
});

// ── POST /agents/lex/contract/:id/analyze ──────────────────
/**
 * @openapi
 * /agents/lex/contract/{id}/analyze:
 *   post:
 *     tags: [Lex (合約)]
 *     summary: AI 合約條款風險分析
 *     description: 由 AI 對現有合約紀錄或提供的合約內容進行風險評估與修改建議
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: string, description: '合約內容（若不提供則依 ID 查詢）' }
 *     responses:
 *       200:
 *         description: AI 合約風險分析報告
 */
lexRouter.post('/contract/:id/analyze', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { content } = req.body as { content?: string };

  const contract = CONTRACTS.find(c => c.contract_id === id);
  if (!contract && !content) {
    res.status(404).json({ error: 'Contract not found and no content provided' });
    return;
  }

  const contractInfo = contract
    ? `合約標題：${contract.title}\n合約類型：${contract.contract_type}\n對象：${contract.counterparty}\n金額：NT$${contract.total_amount}\n保固期：${contract.warranty_months ?? '未知'}個月\n責任上限：${contract.liability_cap ? `NT$${contract.liability_cap}` : '未設定'}\n違約條款：${contract.penalty_clause ?? '未記錄'}`
    : '（以用戶提供的合約內容為準）';

  const userContent = content ?? contractInfo;
  const ragContext  = await queryContractRag(`合約條款審查：${contract?.contract_type ?? 'general'}`);

  const systemPrompt = `${lexSystemPrompt.template}\n\n【相關法規（RAG）】\n${ragContext || '（無法規資料）'}`;

  const analysisPrompt = `請對以下合約進行風險分析，識別潛在法律風險點，並給出具體修改建議：

${userContent}

請以以下格式輸出：
1. 關鍵條款摘要
2. 風險分析（🔴高中低分類）
3. 具體修改建議
4. 相關法條提示`;

  const result = await agentChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: analysisPrompt },
  ], { agentId: AGENT_ID, action: 'LEX_CONTRACT_ANALYZE', temperature: 0.1 });

  res.json({
    contract_id: id ?? 'ad_hoc',
    analysis: result.content,
    disclaimer: '本分析為 AI 輔助，不構成法律意見。重大合約請委請律師審閱。',
  });
});

// ── POST /agents/lex/document (DocHub) ────────────────────
/**
 * @openapi
 * /agents/lex/document:
 *   post:
 *     tags: [Lex (合約)]
 *     summary: 新增文件（DocHub）
 *     description: 登錄根證、許可證、保單、認證等文件至 DocHub，支援到期警示
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, entity_type, category]
 *             properties:
 *               title: { type: string, example: '公司營業登記證' }
 *               entity_type: { type: string }
 *               category: { type: string, enum: [business_license, permit, insurance_policy, certification, design_doc, contract_file, correspondence, other] }
 *               expiry_date: { type: string, format: date }
 *               issuer: { type: string }
 *     responses:
 *       201:
 *         description: 文件登錄成功（含到期警示）
 *   get:
 *     tags: [Lex (合約)]
 *     summary: 查詢文件清單
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: 文件清單
 */
lexRouter.post('/document', async (req: Request, res: Response) => {
  const body = req.body as Partial<DocHubItem>;

  if (!body.title || !body.entity_type || !body.category) {
    res.status(400).json({ error: 'title, entity_type, category are required' });
    return;
  }

  const doc: DocHubItem = {
    doc_id:      crypto.randomUUID(),
    entity_type: body.entity_type,
    category:    body.category,
    title:       body.title,
    issuer:      body.issuer,
    issue_date:  body.issue_date,
    expiry_date: body.expiry_date,
    doc_no:      body.doc_no,
    file_ref:    body.file_ref,
    notes:       body.notes,
    created_at:  now(),
  };

  if (DOCUMENTS.length >= MAX) DOCUMENTS.shift();
  DOCUMENTS.push(doc);

  const expiryWarning = doc.expiry_date && daysUntil(doc.expiry_date) < 60
    ? `⚠️ 文件即將到期（${daysUntil(doc.expiry_date)} 天），請安排更新。`
    : null;

  res.status(201).json({
    doc_id: doc.doc_id,
    expiry_warning: expiryWarning,
  });
});

// ── GET /agents/lex/document/expiring ───────────────────────
/**
 * @openapi
 * /agents/lex/document/expiring:
 *   get:
 *     tags: [Lex (合約)]
 *     summary: 即將到期文件（執照/保單）
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: within_days
 *         schema: { type: integer, default: 60 }
 *     responses:
 *       200:
 *         description: 即將到期文件清單（含逰期項目）
 */
lexRouter.get('/document/expiring', async (req: Request, res: Response) => {
  const { within_days } = req.query as { within_days?: string };
  const days = parseInt(within_days ?? '60');

  const expiring = DOCUMENTS
    .filter(d => d.expiry_date)
    .filter(d => {
      const diff = daysUntil(d.expiry_date!);
      return diff >= 0 && diff <= days;
    })
    .map(d => ({
      doc_id:      d.doc_id,
      entity_type: d.entity_type,
      category:    d.category,
      title:       d.title,
      expiry_date: d.expiry_date,
      days_left:   daysUntil(d.expiry_date!),
    }))
    .sort((a, b) => a.days_left - b.days_left);

  const overdue = DOCUMENTS
    .filter(d => d.expiry_date && daysUntil(d.expiry_date) < 0)
    .map(d => ({
      doc_id:      d.doc_id,
      entity_type: d.entity_type,
      title:       d.title,
      expiry_date: d.expiry_date,
      days_overdue: Math.abs(daysUntil(d.expiry_date!)),
    }));

  res.json({
    within_days,
    expiring_count: expiring.length,
    overdue_count:  overdue.length,
    overdue,
    expiring,
  });
});

// ── GET /agents/lex/health ───────────────────────────────────
/**
 * @openapi
 * /agents/lex/health:
 *   get:
 *     tags: [Lex (合約)]
 *     summary: Lex Agent 健康檢查
 *     description: 回傳合約/文件剩餘統計與即將到期/逰期警示
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: Lex Agent 健康狀態
 */
lexRouter.get('/health', async (_req: Request, res: Response) => {
  const activeContracts  = CONTRACTS.filter(c => c.status === 'active');
  const expiringContracts = activeContracts.filter(
    c => c.expiry_date && daysUntil(c.expiry_date) < 30,
  );
  const overdueContracts = activeContracts.filter(
    c => c.expiry_date && daysUntil(c.expiry_date) < 0,
  );
  const expiringDocs = DOCUMENTS.filter(d => d.expiry_date && daysUntil(d.expiry_date) < 30);

  res.json({
    agent: AGENT_ID,
    status: 'online',
    entity_scope: 'all_companies',
    stats: {
      total_contracts:    CONTRACTS.length,
      active_contracts:   activeContracts.length,
      expiring_contracts: expiringContracts.length,
      overdue_contracts:  overdueContracts.length,
      total_documents:    DOCUMENTS.length,
      expiring_documents: expiringDocs.length,
    },
    alerts: [
      ...overdueContracts.map(c => `🔴 合約到期：${c.title}（${c.counterparty}）`),
      ...expiringContracts.map(c => `⚠️ 合約即將到期（${daysUntil(c.expiry_date!)}天）：${c.title}`),
      ...expiringDocs.map(d => `⚠️ 文件即將到期（${daysUntil(d.expiry_date!)}天）：${d.title}`),
    ],
    timestamp: now(),
  });
});
