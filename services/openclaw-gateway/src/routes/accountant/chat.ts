/**
 * Accountant — Chat Sub-router (A-3 / CR-02)
 *
 * POST /agents/accountant/chat      — 通用會計師問答
 * POST /agents/accountant/invoice   — 發票計算
 * POST /agents/accountant/payment   — 工程請款審查
 * POST /agents/accountant/tax       — 稅額試算
 * GET  /agents/accountant/health    — Agent 狀態
 *
 * 拆分自 routes/accountant.ts（原 L97-L462）
 * 所有推理強制走本地 Ollama（PRIVATE 等級）
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../../logger';
import { ollamaChat } from '../../ollama-inference.service';
import { PrivacyRouter } from '../../privacy-router';
import { accountantSystemPrompt } from '../../prompts';
import { queryRag, detectRagCategory, REGULATION_RAG_URL, AGENT_ID, MODEL } from './shared';

export const chatRouter = Router();

// ── POST /agents/accountant/chat ──────────────────────────────
/**
 * @openapi
 * /agents/accountant/chat:
 *   post:
 *     tags: [Accountant]
 *     summary: 會計師 AI 問答
 *     description: |
 *       通用稅務/帳務問答。敏感財務資料強制走本地 Ollama（PRIVATE 等級，資料不出境）。
 *       若問題包含稅務/勞健保關鍵字，自動查詢 Regulation RAG 補充法規條文。
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AgentChatRequest'
 *           example:
 *             message: "我司今年度營業稅申報期間是幾月？"
 *             session_id: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: AI 回答成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentChatResponse'
 *       400:
 *         description: 缺少 message 欄位
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: Ollama 本地推理不可用
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
chatRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, session_id, user_id, context } = req.body as {
    message?: string;
    session_id?: string;
    user_id?: string;
    context?: string;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const traceId = crypto.randomUUID();
  const ragCategory = detectRagCategory(message);

  let ragContext = '';
  if (ragCategory) {
    logger.info(`[Accountant] Querying RAG (${ragCategory}) for: ${message.slice(0, 50)}`);
    ragContext = await queryRag(message, ragCategory);
  }

  const userContent = ragContext
    ? `【相關法規條文（自動擷取）】\n${ragContext}\n\n---\n\n【使用者問題】${message}${context ? `\n\n【額外背景】${context}` : ''}`
    : `${message}${context ? `\n\n【背景資訊】${context}` : ''}`;

  const inputPreview = PrivacyRouter.redactForLog(message, 'PRIVATE');

  try {
    const { content: reply, latency_ms } = await ollamaChat(
      [
        { role: 'system', content: accountantSystemPrompt.template },
        { role: 'user', content: userContent },
      ],
      MODEL,
      { temperature: 0.1, num_predict: 2048 },
    );

    logger.info(
      `[Accountant/chat] trace=${traceId} latency=${latency_ms}ms rag=${ragCategory ?? 'none'} ` +
      `preview="${inputPreview.slice(0, 40)}"`
    );

    res.json({
      agent_id: AGENT_ID, model: MODEL,
      inference_route: 'local', privacy_level: 'PRIVATE',
      rag_used: ragCategory, trace_id: traceId, latency_ms, reply,
    });
  } catch (err) {
    logger.error(`[Accountant/chat] Error: ${err}`);
    res.status(503).json({ error: 'Accountant agent unavailable', detail: String(err) });
  }
});

// ── POST /agents/accountant/invoice ──────────────────────────
chatRouter.post('/invoice', async (req: Request, res: Response) => {
  const { amount, type = 'taxed', tax_rate = 5, note } = req.body as {
    amount?: number; type?: 'taxed' | 'untaxed'; tax_rate?: number; note?: string;
  };

  if (!amount || amount <= 0) {
    res.status(400).json({ error: 'amount must be a positive number' });
    return;
  }

  const rate = tax_rate / 100;
  let untaxed: number, tax: number, taxed: number;
  if (type === 'taxed') {
    taxed = amount; untaxed = Math.round(amount / (1 + rate)); tax = taxed - untaxed;
  } else {
    untaxed = amount; tax = Math.round(amount * rate); taxed = untaxed + tax;
  }

  let invoiceTypeSuggestion = '';
  if (taxed >= 50000) {
    invoiceTypeSuggestion = '三聯式統一發票（金額達 NT$50,000，建議三聯式以便買方進項抵扣）';
  } else if (taxed >= 200) {
    invoiceTypeSuggestion = '二聯式或三聯式統一發票（視買方需求而定）';
  } else {
    invoiceTypeSuggestion = '金額未達 NT$200 且為非固定性客戶，依統一發票使用辦法第20條可免開發票（買方要求除外）';
  }

  res.json({
    calculation: { input_type: type, input_amount: amount, tax_rate_pct: tax_rate, untaxed_amount: untaxed, tax_amount: tax, taxed_amount: taxed },
    invoice_suggestion: invoiceTypeSuggestion,
    legal_basis: '依《統一發票使用辦法》第 7 條（開立時限）、第 15 條（種類）、第 20 條（免開條件）',
    note: note ?? null,
  });
});

// ── POST /agents/accountant/payment ──────────────────────────
chatRouter.post('/payment', async (req: Request, res: Response) => {
  const {
    contract_amount, advance_paid = 0, advance_deduct_rate = 10,
    retention_rate = 10, current_progress_pct, previous_claimed, items = [],
  } = req.body as {
    contract_amount?: number; advance_paid?: number; advance_deduct_rate?: number;
    retention_rate?: number; current_progress_pct?: number; previous_claimed?: number;
    items?: Array<{ description: string; amount: number }>;
  };

  if (!contract_amount || !current_progress_pct) {
    res.status(400).json({ error: 'contract_amount and current_progress_pct are required' });
    return;
  }

  const itemsTotal = items.reduce((s, i) => s + i.amount, 0);
  const this_period_gross = itemsTotal > 0 ? itemsTotal : Math.round(contract_amount * current_progress_pct / 100);
  const advance_deduct = Math.round(this_period_gross * advance_deduct_rate / 100);
  const retention_deduct = Math.round(this_period_gross * retention_rate / 100);
  const net_this_period = this_period_gross - advance_deduct - retention_deduct;
  const cumulative_claimed = (previous_claimed ?? 0) + this_period_gross;
  const cumulative_pct = Math.round(cumulative_claimed / contract_amount * 100 * 10) / 10;

  const warnings: string[] = [];
  if (cumulative_claimed > contract_amount) warnings.push(`累計請款 NT$${cumulative_claimed.toLocaleString()} 超過合約金額 NT$${contract_amount.toLocaleString()}，請核對！`);
  if (advance_paid > 0 && advance_deduct === 0) warnings.push('有預付款但本期扣回率為 0%，請確認預付款扣回條款');

  res.json({
    payment_calculation: {
      contract_amount, current_progress_pct: `${current_progress_pct}%`, this_period_gross,
      deductions: { advance_deduct: { rate: `${advance_deduct_rate}%`, amount: advance_deduct }, retention_deduct: { rate: `${retention_rate}%`, amount: retention_deduct }, total_deductions: advance_deduct + retention_deduct },
      net_this_period,
    },
    cumulative: { previous_claimed: previous_claimed ?? 0, this_period_gross, total: cumulative_claimed, completion_pct: `${cumulative_pct}%` },
    items_breakdown: items,
    warnings,
    tax_note: `本期請款 NT$${net_this_period.toLocaleString()} 需開立三聯式統一發票（依統一發票使用辦法第15條），含稅總額含5%營業稅為 NT$${Math.round(net_this_period * 1.05).toLocaleString()}`,
  });
});

// ── POST /agents/accountant/tax ───────────────────────────────
chatRouter.post('/tax', async (req: Request, res: Response) => {
  const { type, annual_income, dependents = 0 } = req.body as {
    type?: 'personal' | 'corporate' | 'labor'; annual_income?: number; dependents?: number;
  };

  if (!type || !annual_income) {
    res.status(400).json({ error: 'type and annual_income are required', valid_types: ['personal', 'corporate', 'labor'] });
    return;
  }

  const ragContext = await queryRag(`${type === 'labor' ? '勞健保費率' : '所得稅率'}計算`, type === 'labor' ? 'labor' : 'tax');

  if (type === 'corporate') {
    const BASIC_THRESHOLD = 120000; const TAX_RATE = 0.20;
    const taxable = Math.max(annual_income - BASIC_THRESHOLD, 0);
    return res.json({
      type: 'corporate', annual_income, basic_threshold: BASIC_THRESHOLD,
      taxable_income: taxable, tax_rate: '20%', estimated_tax: Math.round(taxable * TAX_RATE),
      legal_basis: '依《所得稅法》第 98-1 條、《中華民國113年度營利事業所得稅申報資料》',
      note: '實際稅額需依核定所得計算，建議申報前諮詢稅務機關',
      rag_reference: ragContext.slice(0, 200) || '（RAG 未找到相關條文）',
    });
  }

  if (type === 'personal') {
    const EXEMPTION = 92000; const STD_DEDUCT = 124000; const DEP_EXEMPTION = 92000;
    const brackets = [
      { limit: 560000, rate: 0.05 }, { limit: 1260000, rate: 0.12 },
      { limit: 2520000, rate: 0.20 }, { limit: 4720000, rate: 0.30 }, { limit: Infinity, rate: 0.40 },
    ];
    const totalDeduct = EXEMPTION + STD_DEDUCT + (dependents * DEP_EXEMPTION);
    const taxable = Math.max(annual_income - totalDeduct, 0);
    let tax = 0; let remaining = taxable; let prev_limit = 0;
    const breakdown: Array<{ bracket: string; amount: number; rate: string; tax: number }> = [];
    for (const b of brackets) {
      const slice = Math.min(remaining, b.limit - prev_limit);
      if (slice <= 0) break;
      const t = Math.round(slice * b.rate);
      breakdown.push({ bracket: b.limit === Infinity ? `超過 NT$${prev_limit.toLocaleString()}` : `NT$${prev_limit.toLocaleString()} ~ NT$${b.limit.toLocaleString()}`, amount: slice, rate: `${b.rate * 100}%`, tax: t });
      tax += t; remaining -= slice; prev_limit = b.limit;
      if (remaining <= 0) break;
    }
    return res.json({
      type: 'personal', annual_income,
      deductions: { exemption: EXEMPTION, std_deduct: STD_DEDUCT, dependent_exemptions: dependents * DEP_EXEMPTION, total: totalDeduct },
      taxable_income: taxable, tax_breakdown: breakdown, estimated_tax: tax,
      effective_rate: `${(tax / annual_income * 100).toFixed(2)}%`,
      legal_basis: '依《所得稅法》第 5 條（稅率表）、第 17 條（免稅額/扣除額），2024 年度',
      note: '試算結果僅供參考，實際應繳稅額以財政部核定為準',
    });
  }

  if (type === 'labor') {
    const monthly = annual_income;
    const LABOR_EMPLOYER = 0.070; const LABOR_EMPLOYEE = 0.020;
    const HEALTH_EMPLOYER = 0.041758; const HEALTH_EMPLOYEE = 0.021;
    const PENSION_EMPLOYER = 0.060;
    res.json({
      type: 'labor', monthly_salary: monthly, insured_salary: monthly,
      costs: {
        employer: { labor_insurance: Math.round(monthly * LABOR_EMPLOYER), health_insurance: Math.round(monthly * HEALTH_EMPLOYER), labor_pension: Math.round(monthly * PENSION_EMPLOYER), total: Math.round(monthly * (LABOR_EMPLOYER + HEALTH_EMPLOYER + PENSION_EMPLOYER)) },
        employee: { labor_insurance: Math.round(monthly * LABOR_EMPLOYEE), health_insurance: Math.round(monthly * HEALTH_EMPLOYEE), total: Math.round(monthly * (LABOR_EMPLOYEE + HEALTH_EMPLOYEE)) },
      },
      total_labor_cost: Math.round(monthly * (1 + LABOR_EMPLOYER + HEALTH_EMPLOYER + PENSION_EMPLOYER)),
      legal_basis: '依《勞工保險條例》、《全民健康保險法》、《勞工退休金條例》，2024 年費率',
      rag_reference: ragContext.slice(0, 200) || '（RAG 未找到相關條文）',
    });
    return;
  }

  res.status(400).json({ error: `Unknown tax type: ${type}` });
});

// ── GET /agents/accountant/health ─────────────────────────────
chatRouter.get('/health', async (_req: Request, res: Response) => {
  let ragStatus = 'unknown';
  try {
    const r = await fetch(`${REGULATION_RAG_URL}/health`, { signal: AbortSignal.timeout(3000) });
    ragStatus = r.ok ? 'online' : 'degraded';
  } catch { ragStatus = 'offline'; }

  res.json({
    agent_id: AGENT_ID, display_name: 'Kay 🦦 (Accountant)',
    status: 'ready', model: MODEL, inference_route: 'local', privacy_level: 'PRIVATE',
    rag_status: ragStatus, rag_categories: ['tax', 'labor'],
    capabilities: [
      'chat', 'invoice', 'payment', 'tax',
      'ledger_record', 'ledger_query', 'ledger_entity_filter',
      'report_vat_401', 'report_annual', 'report_entity', 'export_csv',
      'bank_account_crud', 'bank_txn_dual_write', 'bank_balance_summary',
      'taxplan_ai_rag', 'taxplan_deduction_instant',
    ],
  });
});
