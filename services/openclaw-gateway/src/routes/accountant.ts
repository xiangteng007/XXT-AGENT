/**
 * Accountant Agent Route — NemoClaw 會計師幕僚
 *
 * POST /agents/accountant/chat              — 自由問答（稅務/帳務）
 * POST /agents/accountant/invoice           — 發票計算與合規檢查
 * POST /agents/accountant/payment           — 工程請款審查
 * POST /agents/accountant/tax               — 稅額試算
 * POST /agents/accountant/ledger            — 新增收支記錄（含實體分類）
 * GET  /agents/accountant/ledger            — 查詢收支明細
 * GET  /agents/accountant/report/summary    — 期間彙總表
 * GET  /agents/accountant/report/401        — 營業稅 401 申報表格式
 * GET  /agents/accountant/report/annual     — 年度收支彙總
 * GET  /agents/accountant/report/entity     — 各實體（公司/個人/家庭）收支比較
 * GET  /agents/accountant/export/csv        — 收支明細表 CSV 匯出
 *
 * POST /agents/accountant/bank/account      — 新增銀行帳戶 [Phase 2]
 * GET  /agents/accountant/bank/accounts     — 查詢帳戶列表 [Phase 2]
 * POST /agents/accountant/bank/txn          — 記錄銀行往來（雙寫至帳本）[Phase 2]
 * GET  /agents/accountant/bank/txn          — 查詢銀行往來明細 [Phase 2]
 * GET  /agents/accountant/bank/balance      — 各帳戶餘額彙總 [Phase 2]
 * POST /agents/accountant/taxplan           — AI 節稅規劃 [Phase 2]
 *
 * GET  /agents/accountant/health            — Agent 狀態
 *
 * 設計原則：
 *   - 所有請求強制走本地 Ollama（qwen3:14b，temperature=0.1）
 *   - Privacy Level 永遠 PRIVATE（財務資料，強制本機，資料不出境）
 *   - 收支記錄持久化至 Firestore accountant_ledger collection
 *   - 報表自動計算台灣營業稅兩個月申報期間
 *   - CSV 匯出含 BOM，Excel 可直接開啟繁體中文
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../logger';
import { ollamaChat } from '../ollama-inference.service';
import { PrivacyRouter } from '../privacy-router';
import {
  addEntry, queryEntries, calcPeriodSummary, calcYearSummary,
  generate401Report, generateLedgerCsv, calcPeriod,
  type LedgerEntry, type LedgerCategory, type EntryType, type EntityType,
} from '../ledger-store';
import {
  addBankAccount, getBankAccounts, getBankAccountByMasked, getBankBalanceSummary,
  addBankTransaction, queryBankTransactions, linkTxnToEntry, updateBankAccountBalance,
  maskAccountNo, entityLabel,
  type BankAccount, type BankTransaction,
} from '../bank-store';
import { accountantSystemPrompt, taxplanSystemPrompt } from '../prompts';

export const accountantRouter = Router();

// ── 設定 ──────────────────────────────────────────────────────
const REGULATION_RAG_URL = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';
const AGENT_ID = 'accountant';
const MODEL    = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';

// ── 工具函數：查詢 RAG ────────────────────────────────────────
async function queryRag(
  question: string,
  category: 'tax' | 'labor' | undefined,
): Promise<string> {
  try {
    const resp = await fetch(`${REGULATION_RAG_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, category, top_k: 3 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return '';
    const data = await resp.json() as {
      results?: Array<{ content: string; source: string; score: number }>;
    };
    const results = data.results ?? [];
    if (results.length === 0) return '';
    return results
      .map(r => `【${r.source}】\n${r.content}`)
      .join('\n\n---\n\n');
  } catch {
    return '';
  }
}

// ── 判斷是否需要查詢法規 ─────────────────────────────────────
function detectRagCategory(
  text: string,
): 'tax' | 'labor' | null {
  const t = text.toLowerCase();
  const taxKeywords = ['發票', '統一發票', '營業稅', '扣繳', '所得稅', '申報', '稅率', '稅額', '含稅', '未稅', '免稅', '零稅率', '進項', '銷項'];
  const laborKeywords = ['薪資', '勞保', '健保', '勞退', '加班', '特休', '年假', '資遣', '退職', '職災', '勞基法', '工資'];

  if (taxKeywords.some(k => t.includes(k))) return 'tax';
  if (laborKeywords.some(k => t.includes(k))) return 'labor';
  return null;
}

// ── POST /agents/accountant/chat ──────────────────────────────
/**
 * @openapi
 * /agents/accountant/chat:
 *   post:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 會計師 AI 問答（自動 RAG 法規查詢）
 *     description: 與 Kay 鳴鑫進行賦務/帳務問答，涉及冠稅決算/勞健保關鍵字自動查詢 RAG
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AgentChatRequest'
 *     responses:
 *       200:
 *         description: AI 回覆
 */
accountantRouter.post('/chat', async (req: Request, res: Response) => {
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

  // 1. 若涉及法規，先查 RAG
  let ragContext = '';
  if (ragCategory) {
    logger.info(`[Accountant] Querying RAG (${ragCategory}) for: ${message.slice(0, 50)}`);
    ragContext = await queryRag(message, ragCategory);
  }

  // 2. 組合 prompt
  const userContent = ragContext
    ? `【相關法規條文（自動擷取）】\n${ragContext}\n\n---\n\n【使用者問題】${message}${context ? `\n\n【額外背景】${context}` : ''}`
    : `${message}${context ? `\n\n【背景資訊】${context}` : ''}`;

  // 3. 呼叫本地 Ollama（強制 PRIVATE）
  const classification = PrivacyRouter.classify(message);
  const inputPreview = PrivacyRouter.redactForLog(message, 'PRIVATE');

  try {
    const startTs = Date.now();
    const { content: reply, latency_ms } = await ollamaChat(
      [
        { role: 'system', content: accountantSystemPrompt.template },
        { role: 'user', content: userContent },
      ],
      MODEL,
      { temperature: 0.1, num_predict: 2048 },
    );

    // 稽核記錄
    logger.info(
      `[Accountant/chat] trace=${traceId} latency=${latency_ms}ms rag=${ragCategory ?? 'none'} ` +
      `preview="${inputPreview.slice(0, 40)}"`
    );

    res.json({
      agent_id: AGENT_ID,
      model: MODEL,
      inference_route: 'local',
      privacy_level: 'PRIVATE',
      rag_used: ragCategory,
      trace_id: traceId,
      latency_ms,
      reply,
    });
  } catch (err) {
    logger.error(`[Accountant/chat] Error: ${err}`);
    res.status(503).json({ error: 'Accountant agent unavailable', detail: String(err) });
  }
});

// ── POST /agents/accountant/invoice ──────────────────────────
/**
 * @openapi
 * /agents/accountant/invoice:
 *   post:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 發票計算與合規建議
 *     description: 含稅金額與未稅金額相互轉換，自動建議發票種類（二/三職式）
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, example: 105000 }
 *               type: { type: string, enum: [taxed, untaxed], default: taxed }
 *               tax_rate: { type: number, default: 5 }
 *               note: { type: string }
 *     responses:
 *       200:
 *         description: 發票計算結果與品種建議
 */
accountantRouter.post('/invoice', async (req: Request, res: Response) => {
  const { amount, type = 'taxed', tax_rate = 5, note } = req.body as {
    amount?: number;
    type?: 'taxed' | 'untaxed';
    tax_rate?: number;
    note?: string;
  };

  if (!amount || amount <= 0) {
    res.status(400).json({ error: 'amount must be a positive number' });
    return;
  }

  const rate = tax_rate / 100;
  let untaxed: number, tax: number, taxed: number;

  if (type === 'taxed') {
    // 含稅金額 → 拆解
    taxed   = amount;
    untaxed = Math.round(amount / (1 + rate));
    tax     = taxed - untaxed;
  } else {
    // 未稅金額 → 加稅
    untaxed = amount;
    tax     = Math.round(amount * rate);
    taxed   = untaxed + tax;
  }

  // 決定發票種類建議
  let invoiceTypeSuggestion = '';
  if (taxed >= 50000) {
    invoiceTypeSuggestion = '三聯式統一發票（金額達 NT$50,000，建議三聯式以便買方進項抵扣）';
  } else if (taxed >= 200) {
    invoiceTypeSuggestion = '二聯式或三聯式統一發票（視買方需求而定）';
  } else {
    invoiceTypeSuggestion = '金額未達 NT$200 且為非固定性客戶，依統一發票使用辦法第20條可免開發票（買方要求除外）';
  }

  res.json({
    calculation: {
      input_type: type,
      input_amount: amount,
      tax_rate_pct: tax_rate,
      untaxed_amount: untaxed,
      tax_amount: tax,
      taxed_amount: taxed,
    },
    invoice_suggestion: invoiceTypeSuggestion,
    legal_basis: '依《統一發票使用辦法》第 7 條（開立時限）、第 15 條（種類）、第 20 條（免開條件）',
    note: note ?? null,
  });
});

// ── POST /agents/accountant/payment ──────────────────────────
/**
 * @openapi
 * /agents/accountant/payment:
 *   post:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 工程請款審查
 *     description: 驗證請款金額、保留款比例、預付款扣回是否符合合約邏輯
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contract_amount, current_progress_pct]
 *             properties:
 *               contract_amount: { type: number }
 *               current_progress_pct: { type: number, example: 30 }
 *               advance_paid: { type: number, default: 0 }
 *               advance_deduct_rate: { type: number, default: 10 }
 *               retention_rate: { type: number, default: 10 }
 *               previous_claimed: { type: number, default: 0 }
 *               items: { type: array, items: { type: object, properties: { description: { type: string }, amount: { type: number } } } }
 *     responses:
 *       200:
 *         description: 請款計算結果與警示
 */
accountantRouter.post('/payment', async (req: Request, res: Response) => {
  const {
    contract_amount,
    advance_paid = 0,
    advance_deduct_rate = 10,
    retention_rate = 10,
    current_progress_pct,
    previous_claimed,
    items = [],
  } = req.body as {
    contract_amount?: number;
    advance_paid?: number;
    advance_deduct_rate?: number;
    retention_rate?: number;
    current_progress_pct?: number;
    previous_claimed?: number;
    items?: Array<{ description: string; amount: number }>;
  };

  if (!contract_amount || !current_progress_pct) {
    res.status(400).json({ error: 'contract_amount and current_progress_pct are required' });
    return;
  }

  const itemsTotal = items.reduce((s, i) => s + i.amount, 0);
  const this_period_gross = itemsTotal > 0
    ? itemsTotal
    : Math.round(contract_amount * current_progress_pct / 100);

  const advance_deduct     = Math.round(this_period_gross * advance_deduct_rate / 100);
  const retention_deduct   = Math.round(this_period_gross * retention_rate / 100);
  const net_this_period    = this_period_gross - advance_deduct - retention_deduct;

  const cumulative_claimed = (previous_claimed ?? 0) + this_period_gross;
  const cumulative_pct     = Math.round(cumulative_claimed / contract_amount * 100 * 10) / 10;

  const warnings: string[] = [];
  if (cumulative_claimed > contract_amount) {
    warnings.push(`累計請款 NT$${cumulative_claimed.toLocaleString()} 超過合約金額 NT$${contract_amount.toLocaleString()}，請核對！`);
  }
  if (advance_paid > 0 && advance_deduct === 0) {
    warnings.push('有預付款但本期扣回率為 0%，請確認預付款扣回條款');
  }

  res.json({
    payment_calculation: {
      contract_amount,
      current_progress_pct: `${current_progress_pct}%`,
      this_period_gross,
      deductions: {
        advance_deduct: { rate: `${advance_deduct_rate}%`, amount: advance_deduct },
        retention_deduct: { rate: `${retention_rate}%`, amount: retention_deduct },
        total_deductions: advance_deduct + retention_deduct,
      },
      net_this_period,
    },
    cumulative: {
      previous_claimed: previous_claimed ?? 0,
      this_period_gross,
      total: cumulative_claimed,
      completion_pct: `${cumulative_pct}%`,
    },
    items_breakdown: items,
    warnings,
    tax_note: `本期請款 NT$${net_this_period.toLocaleString()} 需開立三聯式統一發票（依統一發票使用辦法第15條），含稅總額含5%營業稅為 NT$${Math.round(net_this_period * 1.05).toLocaleString()}`,
  });
});

// ── POST /agents/accountant/tax ───────────────────────────────
/**
 * @openapi
 * /agents/accountant/tax:
 *   post:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 稅額試算
 *     description: 支援個人綜所稅、公司営所稅、勞健保費試算，自動查詢稅務法規 RAG
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, annual_income]
 *             properties:
 *               type: { type: string, enum: [personal, corporate, labor] }
 *               annual_income: { type: number, description: '勞健保 type 用月薪', example: 600000 }
 *               dependents: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: 稅額試算結果（含法源）
 */
accountantRouter.post('/tax', async (req: Request, res: Response) => {
  const { type, annual_income, dependents = 0 } = req.body as {
    type?: 'personal' | 'corporate' | 'labor';
    annual_income?: number;
    dependents?: number;
  };

  if (!type || !annual_income) {
    res.status(400).json({
      error: 'type and annual_income are required',
      valid_types: ['personal', 'corporate', 'labor'],
    });
    return;
  }

  // RAG 查詢 — 補充法規背景
  const ragContext = await queryRag(`${type === 'labor' ? '勞健保費率' : '所得稅率'}計算`, type === 'labor' ? 'labor' : 'tax');

  if (type === 'corporate') {
    // 公司所得稅（2024，稅率 20%，起徵點 120,000）
    const BASIC_THRESHOLD = 120000;
    const TAX_RATE = 0.20;
    const taxable = Math.max(annual_income - BASIC_THRESHOLD, 0);
    const estimated_tax = Math.round(taxable * TAX_RATE);

    return res.json({
      type: 'corporate',
      annual_income,
      basic_threshold: BASIC_THRESHOLD,
      taxable_income: taxable,
      tax_rate: '20%',
      estimated_tax,
      legal_basis: '依《所得稅法》第 98-1 條、《中華民國113年度營利事業所得稅申報資料》',
      note: '實際稅額需依核定所得計算，建議申報前諮詢稅務機關',
      rag_reference: ragContext.slice(0, 200) || '（RAG 未找到相關條文）',
    });
  }

  if (type === 'personal') {
    // 個人綜所稅（2024 稅率表）
    // 免稅額：92,000，標準扣除額：124,000（單身）
    const EXEMPTION    = 92000;
    const STD_DEDUCT   = 124000;
    const DEP_EXEMPTION = 92000;
    const brackets = [
      { limit: 560000,   rate: 0.05 },
      { limit: 1260000,  rate: 0.12 },
      { limit: 2520000,  rate: 0.20 },
      { limit: 4720000,  rate: 0.30 },
      { limit: Infinity, rate: 0.40 },
    ];

    const totalDeduct = EXEMPTION + STD_DEDUCT + (dependents * DEP_EXEMPTION);
    const taxable = Math.max(annual_income - totalDeduct, 0);

    let tax = 0;
    let remaining = taxable;
    let prev_limit = 0;
    const breakdown: Array<{ bracket: string; amount: number; rate: string; tax: number }> = [];

    for (const b of brackets) {
      const slice = Math.min(remaining, b.limit - prev_limit);
      if (slice <= 0) break;
      const t = Math.round(slice * b.rate);
      breakdown.push({
        bracket: b.limit === Infinity ? `超過 NT$${prev_limit.toLocaleString()}` : `NT$${prev_limit.toLocaleString()} ~ NT$${b.limit.toLocaleString()}`,
        amount: slice,
        rate: `${b.rate * 100}%`,
        tax: t,
      });
      tax += t;
      remaining -= slice;
      prev_limit = b.limit;
      if (remaining <= 0) break;
    }

    return res.json({
      type: 'personal',
      annual_income,
      deductions: { exemption: EXEMPTION, std_deduct: STD_DEDUCT, dependent_exemptions: dependents * DEP_EXEMPTION, total: totalDeduct },
      taxable_income: taxable,
      tax_breakdown: breakdown,
      estimated_tax: tax,
      effective_rate: `${(tax / annual_income * 100).toFixed(2)}%`,
      legal_basis: '依《所得稅法》第 5 條（稅率表）、第 17 條（免稅額/扣除額），2024 年度',
      note: '試算結果僅供參考，實際應繳稅額以財政部核定為準',
    });
  }

  if (type === 'labor') {
    // 月薪 → 勞健保費試算
    const monthly = annual_income;  // 此 type 用月薪
    // 2024 費率：勞保 10.5%（雇主 7%，員工 20%→ 2.1?...）
    // 勞保：雇主 7.0%，員工 2.0%，政府 1.5%（自月投保薪資）
    // 健保：雇主 4.1758%，員工 2.1%（自薪資）
    // 勞退：雇主強制 6%
    const LABOR_EMPLOYER = 0.070;
    const LABOR_EMPLOYEE = 0.020;
    const HEALTH_EMPLOYER = 0.041758;
    const HEALTH_EMPLOYEE = 0.021;
    const PENSION_EMPLOYER = 0.060;

    // 投保薪資分級（簡化，實際需對照分級表）
    const insured = monthly;

    res.json({
      type: 'labor',
      monthly_salary: monthly,
      insured_salary: insured,
      costs: {
        employer: {
          labor_insurance: Math.round(insured * LABOR_EMPLOYER),
          health_insurance: Math.round(insured * HEALTH_EMPLOYER),
          labor_pension: Math.round(insured * PENSION_EMPLOYER),
          total: Math.round(insured * (LABOR_EMPLOYER + HEALTH_EMPLOYER + PENSION_EMPLOYER)),
        },
        employee: {
          labor_insurance: Math.round(insured * LABOR_EMPLOYEE),
          health_insurance: Math.round(insured * HEALTH_EMPLOYEE),
          total: Math.round(insured * (LABOR_EMPLOYEE + HEALTH_EMPLOYEE)),
        },
      },
      total_labor_cost: Math.round(insured * (1 + LABOR_EMPLOYER + HEALTH_EMPLOYER + PENSION_EMPLOYER)),
      legal_basis: '依《勞工保險條例》、《全民健康保險法》、《勞工退休金條例》，2024 年費率',
      rag_reference: ragContext.slice(0, 200) || '（RAG 未找到相關條文）',
    });
    return;
  }

  res.status(400).json({ error: `Unknown tax type: ${type}` });
});

// ── GET /agents/accountant/health ─────────────────────────────
/**
 * @openapi
 * /agents/accountant/health:
 *   get:
 *     tags: [Accountant (鳴鑫)]
 *     summary: Accountant Agent 健康檢查
 *     description: 回傳 Kay 鳴鑫 Agent 狀態、RAG 可用性與能力清單
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: Agent 健康狀態
 */
accountantRouter.get('/health', async (_req: Request, res: Response) => {
  // 測試 RAG 連線
  let ragStatus = 'unknown';
  try {
    const r = await fetch(`${REGULATION_RAG_URL}/health`, { signal: AbortSignal.timeout(3000) });
    ragStatus = r.ok ? 'online' : 'degraded';
  } catch {
    ragStatus = 'offline';
  }

  res.json({
    agent_id: AGENT_ID,
    display_name: 'Kay 🦦 (Accountant)',
    status: 'ready',
    model: MODEL,
    inference_route: 'local',
    privacy_level: 'PRIVATE',
    rag_status: ragStatus,
    rag_categories: ['tax', 'labor'],
    capabilities: [
      'chat', 'invoice', 'payment', 'tax',
      'ledger_record', 'ledger_query', 'ledger_entity_filter',
      'report_vat_401', 'report_annual', 'report_entity', 'export_csv',
      'bank_account_crud', 'bank_txn_dual_write', 'bank_balance_summary',
      'taxplan_ai_rag', 'taxplan_deduction_instant',
    ],
  });
});

// ============================================================
// ── 帳本模組 (NemoClaw 收支記錄與稅務文件) ──────────────────
// ============================================================

// ── POST /agents/accountant/ledger ── 新增收支記錄 ───────────
/**
 * @openapi
 * /agents/accountant/ledger:
 *   post:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 新增收支記錄
 *     description: 將收入/支出記錄寫入帳本，支援多公司實體分類、自動計算稅額
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, category, description, amount]
 *             properties:
 *               type: { type: string, enum: [income, expense] }
 *               category: { type: string, example: engineering_payment }
 *               description: { type: string, example: '台北公館工程請款' }
 *               amount: { type: number }
 *               amount_type: { type: string, enum: [taxed, untaxed], default: taxed }
 *               entity_type: { type: string, default: co_construction }
 *               transaction_date: { type: string, format: date }
 *               invoice_no: { type: string }
 *   get:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 查詢收支明細
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [income, expense, all] }
 *       - in: query
 *         name: period
 *         schema: { type: string, example: '202605' }
 *       - in: query
 *         name: entity_type
 *         schema: { type: string }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200:
 *         description: 收支明細（含小計）
 *       201:
 *         description: 帳目成功建立
 */


accountantRouter.post('/ledger', async (req: Request, res: Response) => {
  const {
    type, category, description, amount,
    amount_type = 'taxed', tax_rate = 5, is_tax_exempt = false,
    transaction_date, invoice_no, invoice_type = 'three_copy',
    counterparty_name, counterparty_tax_id,
    project_id, is_deductible, notes,
    company_id = 'senteng', user_id,
    entity_type = 'co_construction', payment_method,
  } = req.body as {
    type?: EntryType; category?: LedgerCategory;
    description?: string; amount?: number;
    amount_type?: 'taxed' | 'untaxed'; tax_rate?: number; is_tax_exempt?: boolean;
    transaction_date?: string; invoice_no?: string; invoice_type?: string;
    counterparty_name?: string; counterparty_tax_id?: string;
    project_id?: string; is_deductible?: boolean; notes?: string;
    company_id?: string; user_id?: string;
    entity_type?: EntityType; payment_method?: string;
  };

  if (!type || !category || !description || !amount || amount <= 0) {
    res.status(400).json({
      error: 'type, category, description, amount are required',
      income_categories: ['engineering_payment','advance_payment','design_fee','consulting_fee','material_rebate','other_income','salary','freelance','rental_income','investment_gain','allowance'],
      expense_categories: ['material','labor','subcontract','equipment','overhead','insurance','tax_payment','utilities','rent','office_supply','entertainment','transportation','professional_service','other_expense','medical','education','life_insurance','house_rent','family_living'],
      entity_types: ['personal','family','co_drone','co_construction','co_renovation','co_design','assoc_rescue'],
    });
    return;
  }

  const rate = is_tax_exempt ? 0 : tax_rate / 100;
  let amount_untaxed: number, tax_amount: number, amount_taxed: number;
  if (amount_type === 'taxed') {
    amount_taxed   = Math.round(amount);
    amount_untaxed = Math.round(amount / (1 + rate));
    tax_amount     = amount_taxed - amount_untaxed;
  } else {
    amount_untaxed = Math.round(amount);
    tax_amount     = Math.round(amount * rate);
    amount_taxed   = amount_untaxed + tax_amount;
  }

  const txDate  = transaction_date ?? new Date().toISOString().slice(0, 10);
  const period  = calcPeriod(txDate);
  const entryId = crypto.randomUUID();

  const entry: LedgerEntry = {
    entry_id: entryId, company_id, project_id,
    entity_type: entity_type as EntityType,
    type, category, description,
    amount_untaxed, tax_amount, amount_taxed,
    tax_rate: is_tax_exempt ? 0 : tax_rate, is_tax_exempt,
    invoice: invoice_no ? {
      invoice_no,
      invoice_type: invoice_type as 'two_copy' | 'three_copy' | 'electronic' | 'receipt',
      buyer_name: counterparty_name,
      buyer_tax_id: counterparty_tax_id,
    } : undefined,
    counterparty_name, counterparty_tax_id,
    payment_method: payment_method as LedgerEntry['payment_method'],
    transaction_date: txDate, period,
    created_at: new Date().toISOString(),
    created_by: user_id ?? 'accountant-bot',
    is_deductible: type === 'expense' ? (is_deductible ?? true) : undefined,
    notes,
  };
  await addEntry(entry);
  logger.info(`[Ledger] ${type} ${entryId} NT$${amount_taxed} ${category} period=${period}`);

  const entityLabelLocal = entity_type === 'personal' ? '個人' : entity_type === 'family' ? '家庭' : '公司';
  res.status(201).json({
    ok: true, entry_id: entryId,
    summary: { type, category, description, amount_untaxed, tax_amount, amount_taxed, period,
      transaction_date: txDate, entity_type, entity_label: entityLabelLocal },
    message: `已記入帳本（${entityLabelLocal}）：${type === 'income' ? '收入' : '支出'} NT$${amount_taxed.toLocaleString()} · ${description}`,
  });
});

// ── GET /agents/accountant/ledger ── 查詢收支明細 ────────────
accountantRouter.get('/ledger', async (req: Request, res: Response) => {
  const { type, period, project_id, category, date_from, date_to, limit, entity_type, year } =
    req.query as Record<string, string | undefined>;

  const validEntities: EntityType[] = ['personal', 'family', 'co_drone', 'co_construction', 'co_renovation', 'co_design', 'assoc_rescue'];
  const entries = await queryEntries({
    type: (type as EntryType | 'all') ?? 'all',
    period, project_id,
    category: category as LedgerCategory,
    entity_type: validEntities.includes(entity_type as EntityType) ? entity_type as EntityType : undefined,
    date_from, date_to,
    year: year ? parseInt(year) : undefined,
    limit: limit ? parseInt(limit) : 100,
  });

  const totalIncome  = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount_taxed, 0);
  const totalExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount_taxed, 0);

  res.json({
    count: entries.length,
    query: { type: type ?? 'all', period, entity_type: entity_type ?? 'all', year },
    summary: { total_income: totalIncome, total_expense: totalExpense, net: totalIncome - totalExpense },
    entries: entries.map(e => ({
      ...e,
      entity_label: e.entity_type === 'personal' ? '個人' : e.entity_type === 'family' ? '家庭' : '公司',
    })),
  });
});

// ── GET /agents/accountant/report/summary ── 期間彙總 ────────
/**
 * @openapi
 * /agents/accountant/report/summary:
 *   get:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 期間收支彙總表
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: period
 *         required: true
 *         schema: { type: string, example: '202605', description: 'YYYYMM' }
 *     responses:
 *       200:
 *         description: 期間彙總（收入/支出/發票）
 */
accountantRouter.get('/report/summary', async (req: Request, res: Response) => {
  const { period } = req.query as { period?: string };
  if (!period || !/^\d{6}$/.test(period)) {
    res.status(400).json({ error: 'period required (YYYYMM)' });
    return;
  }
  res.json(await calcPeriodSummary(period));
});

// ── GET /agents/accountant/report/401 ── 401 申報表 ──────────
/**
 * @openapi
 * /agents/accountant/report/401:
 *   get:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 營業稅 401 申報表
 *     description: 自動生成符合財政部格式的 401 申報表（需核對實際發票）
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: period
 *         required: true
 *         schema: { type: string, example: '202605' }
 *       - in: query
 *         name: company_name
 *         schema: { type: string }
 *       - in: query
 *         name: tax_id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 401 申報表格式 JSON
 */
accountantRouter.get('/report/401', async (req: Request, res: Response) => {
  const {
    period,
    company_name = 'SENTENG 建工股份有限公司',
    tax_id = '',
  } = req.query as { period?: string; company_name?: string; tax_id?: string };

  if (!period || !/^\d{6}$/.test(period)) {
    res.status(400).json({ error: 'period required (YYYYMM)' });
    return;
  }

  const summary = await calcPeriodSummary(period);
  const report  = generate401Report(summary, company_name, tax_id);

  res.json({
    generated_by: 'accountant-agent-v1',
    disclaimer: '⚠️ 本表由鳴鑫會計師 AI 自動生成，申報前請核對實際發票資料再由負責人簽章申報',
    report,
    raw_summary: summary,
  });
});

// ── GET /agents/accountant/report/annual ── 年度彙總 ─────────
/**
 * @openapi
 * /agents/accountant/report/annual:
 *   get:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 年度收支彙總
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *     responses:
 *       200:
 *         description: 年度收支彙總（按月與實體分布）
 */
accountantRouter.get('/report/annual', async (req: Request, res: Response) => {
  const { year } = req.query as { year?: string };
  const y = year ? parseInt(year) : new Date().getFullYear();
  if (isNaN(y) || y < 2020 || y > 2100) {
    res.status(400).json({ error: 'year must be valid (e.g. 2026)' });
    return;
  }
  res.json({ generated_by: 'accountant-agent-v1', ...(await calcYearSummary(y)) });
});

// ── GET /agents/accountant/export/csv ── CSV 匯出 ─────────────
/**
 * @openapi
 * /agents/accountant/export/csv:
 *   get:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 收支明細表 CSV 匯出
 *     description: CSV 含 UTF-8 BOM，可直接在 Excel 開啟繁體中文
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, example: '202605' }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: CSV 檔案
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
accountantRouter.get('/export/csv', async (req: Request, res: Response) => {
  const { period, year } = req.query as { period?: string; year?: string };
  if (!period && !year) {
    res.status(400).json({ error: 'period (YYYYMM) or year (YYYY) required' });
    return;
  }

  const csv = await generateLedgerCsv(period, year ? parseInt(year) : undefined);
  const filename = period ? `收支明細_${period}.csv` : `收支明細_${year}年.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send('\uFEFF' + csv);  // UTF-8 BOM — Excel 開啟正確顯示繁中
});

// ────────────────────────────────────────────────────────────────
// Phase 2: 銀行帳戶 + 多實體收支 + 節稅規劃
// ────────────────────────────────────────────────────────────────

// ── POST /agents/accountant/bank/account ── 新增銀行帳戶 ────────
/**
 * @openapi
 * /agents/accountant/bank/account:
 *   post:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 新增銀行帳戶
 *     description: 新增銀行帳戶，帳號自動遮罩（如 ****5678）
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bank_name, account_no, account_holder]
 *             properties:
 *               bank_name: { type: string, example: '臺灣銀行' }
 *               account_no: { type: string }
 *               account_holder: { type: string }
 *               entity_type: { type: string }
 *               current_balance: { type: number, default: 0 }
 *     responses:
 *       201:
 *         description: 銀行帳戶已新增
 */
accountantRouter.post('/bank/account', async (req: Request, res: Response) => {
  const b = req.body as {
    bank_name?: string; bank_code?: string; account_no?: string;
    account_holder?: string; entity_type?: string; currency?: string;
    current_balance?: number; notes?: string;
  };
  if (!b.bank_name || !b.account_no || !b.account_holder) {
    res.status(400).json({ error: 'bank_name, account_no, account_holder required' }); return;
  }
  const validEntities: EntityType[] = ['personal', 'family', 'co_drone', 'co_construction', 'co_renovation', 'co_design', 'assoc_rescue'];
  const entity: EntityType = validEntities.includes(b.entity_type as EntityType)
    ? b.entity_type as EntityType : 'co_construction';
  const account: BankAccount = {
    account_id: crypto.randomUUID(), company_id: 'default', entity_type: entity,
    bank_name: b.bank_name, bank_code: b.bank_code ?? '',
    account_no_masked: maskAccountNo(b.account_no), account_no_full: b.account_no,
    account_holder: b.account_holder, currency: b.currency === 'USD' ? 'USD' : 'TWD',
    current_balance: b.current_balance ?? 0, is_active: true,
    created_at: new Date().toISOString(), notes: b.notes,
  };
  const result = await addBankAccount(account);
  res.status(201).json({
    ok: result.ok, account_id: result.account_id,
    summary: {
      bank_name: account.bank_name, account_no_masked: account.account_no_masked,
      account_holder: account.account_holder, entity_type: account.entity_type,
      entity_label: entityLabel(entity), currency: account.currency, current_balance: account.current_balance,
    },
    message: `${entityLabel(entity)}帳戶「${account.bank_name} ${account.account_no_masked}」已新增`,
  });
});

// ── GET /agents/accountant/bank/accounts ── 查詢帳戶列表 ────────
/**
 * @openapi
 * /agents/accountant/bank/accounts:
 *   get:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 查詢銀行帳戶列表
 *     description: 帳號已遮罩，可依實體體過濾
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: entity_type
 *         schema: { type: string }
 *       - in: query
 *         name: active_only
 *         schema: { type: boolean, default: true }
 *     responses:
 *       200:
 *         description: 帳戶列表
 */
accountantRouter.get('/bank/accounts', async (req: Request, res: Response) => {
  const { entity_type, active_only } = req.query as { entity_type?: string; active_only?: string };
  const validEntities: EntityType[] = ['personal', 'family', 'co_drone', 'co_construction', 'co_renovation', 'co_design', 'assoc_rescue'];
  const entity = validEntities.includes(entity_type as EntityType) ? entity_type as EntityType : undefined;
  const accounts = await getBankAccounts({ entity_type: entity, active_only: active_only !== 'false' });
  const safe = accounts.map(a => ({
    account_id: a.account_id, entity_type: a.entity_type, entity_label: entityLabel(a.entity_type),
    bank_name: a.bank_name, bank_code: a.bank_code, account_no_masked: a.account_no_masked,
    account_holder: a.account_holder, currency: a.currency, current_balance: a.current_balance,
    is_active: a.is_active, notes: a.notes,
  }));
  res.json({ count: safe.length, accounts: safe });
});

// ── GET /agents/accountant/bank/balance ── 餘額彙總 ─────────────
/**
 * @openapi
 * /agents/accountant/bank/balance:
 *   get:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 各帳戶餘額彙總
 *     description: 將所有銀行帳戶餘額依實體分組彙總，並提供總餘額
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: 各帳戶餘額（包含円台安幣總額）
 */
accountantRouter.get('/bank/balance', async (_req: Request, res: Response) => {
  const summaries = await getBankBalanceSummary();
  const grand_total = summaries.reduce((s, x) => s + x.total_balance_twd, 0);
  res.json({
    generated_at: new Date().toISOString(), grand_total_twd: grand_total,
    by_entity: summaries.map(s => ({
      entity_type: s.entity_type, entity_label: entityLabel(s.entity_type),
      account_count: s.accounts.length, total_balance: s.total_balance_twd, accounts: s.accounts,
    })),
  });
});

// ── POST /agents/accountant/bank/txn ── 記錄銀行往來（雙寫帳本）──
/**
 * @openapi
 * /agents/accountant/bank/txn:
 *   post:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 記錄銀行往來（雙寫帳本）
 *     description: 新增銀行交易，若指定 ledger_category 則同時寫入帳本
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, amount, description]
 *             properties:
 *               type: { type: string, enum: [credit, debit] }
 *               amount: { type: number }
 *               description: { type: string }
 *               account_no_masked: { type: string }
 *               account_id: { type: string, format: uuid }
 *               ledger_category: { type: string }
 *               counterparty: { type: string }
 *   get:
 *     tags: [Accountant (鳴鑫)]
 *     summary: 查詢銀行往來明細
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: account_id
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [credit, debit] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: 銀行往來明細
 *       201:
 *         description: 交易已記錄（含帳本雙寫狀態）
 */
accountantRouter.post('/bank/txn', async (req: Request, res: Response) => {
  const b = req.body as {
    account_no_masked?: string; account_id?: string; type?: string; amount?: number;
    txn_date?: string; description?: string; counterparty?: string;
    reference_no?: string; balance_after?: number; ledger_category?: string; payment_method?: string;
  };
  if (!b.type || !b.amount || !b.description) {
    res.status(400).json({ error: 'type, amount, description required' }); return;
  }
  if (b.type !== 'credit' && b.type !== 'debit') {
    res.status(400).json({ error: 'type must be credit or debit' }); return;
  }
  let account = null;
  if (b.account_id) {
    const all = await getBankAccounts({ active_only: true });
    account = all.find(a => a.account_id === b.account_id) ?? null;
  } else if (b.account_no_masked) {
    account = await getBankAccountByMasked(b.account_no_masked);
  }
  if (!account) { res.status(404).json({ error: 'Bank account not found. Use GET /bank/accounts to list.' }); return; }

  const txnDate = b.txn_date ?? new Date().toISOString().slice(0, 10);
  const txn: BankTransaction = {
    txn_id: crypto.randomUUID(), account_id: account.account_id, entity_type: account.entity_type,
    type: b.type as 'credit' | 'debit', amount: Math.round(b.amount), balance_after: b.balance_after,
    txn_date: txnDate, description: b.description, counterparty: b.counterparty,
    reference_no: b.reference_no, ledger_category: b.ledger_category,
    payment_method: b.payment_method, created_at: new Date().toISOString(), created_by: 'accountant-bot',
  };
  const txnResult = await addBankTransaction(txn);
  if (b.balance_after !== undefined) await updateBankAccountBalance(account.account_id, b.balance_after);

  let linked_entry_id: string | null = null;
  if (b.ledger_category) {
    const entryType: EntryType = b.type === 'credit' ? 'income' : 'expense';
    const isTaxExempt = ['salary', 'allowance', 'family_living', 'investment_gain'].includes(b.ledger_category);
    const taxRate = isTaxExempt ? 0 : 5;
    const amountUntaxed = isTaxExempt ? Math.round(b.amount) : Math.round(b.amount / 1.05);
    const entry: LedgerEntry = {
      entry_id: crypto.randomUUID(), company_id: 'default', entity_type: account.entity_type,
      type: entryType, category: b.ledger_category as LedgerCategory,
      description: b.description, amount_untaxed: amountUntaxed,
      tax_amount: Math.round(b.amount) - amountUntaxed, amount_taxed: Math.round(b.amount),
      tax_rate: taxRate, is_tax_exempt: isTaxExempt, counterparty_name: b.counterparty,
      payment_method: 'bank_transfer', bank_account_id: account.account_id, bank_txn_id: txn.txn_id,
      transaction_date: txnDate, period: calcPeriod(txnDate),
      created_at: new Date().toISOString(), created_by: 'accountant-bot',
    };
    const entryResult = await addEntry(entry);
    linked_entry_id = entryResult.entry_id;
    await linkTxnToEntry(txn.txn_id, linked_entry_id);
  }
  res.status(201).json({
    ok: true, txn_id: txnResult.txn_id, linked_entry_id, dual_write: linked_entry_id !== null,
    summary: {
      bank: `${account.bank_name} ${account.account_no_masked}`, entity: entityLabel(account.entity_type),
      type: b.type === 'credit' ? '存入（收入）' : '提出（支出）',
      amount: Math.round(b.amount), txn_date: txnDate, description: b.description, ledger_synced: linked_entry_id !== null,
    },
  });
});

// ── GET /agents/accountant/bank/txn ── 查詢銀行往來 ─────────────
accountantRouter.get('/bank/txn', async (req: Request, res: Response) => {
  const { account_no_masked, account_id, entity_type, period, type, limit } = req.query as Record<string, string | undefined>;
  let resolvedAccountId = account_id;
  if (!resolvedAccountId && account_no_masked) {
    const acct = await getBankAccountByMasked(account_no_masked);
    resolvedAccountId = acct?.account_id;
  }
  const validEntities: EntityType[] = ['personal', 'family', 'co_drone', 'co_construction', 'co_renovation', 'co_design', 'assoc_rescue'];
  const entity = validEntities.includes(entity_type as EntityType) ? entity_type as EntityType : undefined;
  const txns = await queryBankTransactions({
    account_id: resolvedAccountId, entity_type: entity, period,
    type: (type === 'credit' || type === 'debit') ? type : undefined,
    limit: limit ? parseInt(limit) : 30,
  });
  const totalCredit = txns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalDebit  = txns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
  res.json({
    count: txns.length, total_credit: totalCredit, total_debit: totalDebit, net: totalCredit - totalDebit,
    transactions: txns.map(t => ({
      txn_id: t.txn_id, entity_type: t.entity_type, entity_label: entityLabel(t.entity_type),
      type: t.type, type_label: t.type === 'credit' ? '存入' : '提出',
      amount: t.amount, balance_after: t.balance_after, txn_date: t.txn_date,
      description: t.description, counterparty: t.counterparty,
      ledger_category: t.ledger_category, linked_entry_id: t.linked_entry_id,
    })),
  });
});

// ── GET /agents/accountant/report/entity ── 各實體收支比較 ───────
accountantRouter.get('/report/entity', async (req: Request, res: Response) => {
  const { entity, period, year } = req.query as Record<string, string | undefined>;
  const validEntities: EntityType[] = ['personal', 'family', 'co_drone', 'co_construction', 'co_renovation', 'co_design', 'assoc_rescue'];
  const targetYear = year ? parseInt(year) : new Date().getFullYear();
  const entitiesToQuery: EntityType[] = validEntities.includes(entity as EntityType)
    ? [entity as EntityType] : validEntities;
  const results = await Promise.all(entitiesToQuery.map(async (ent) => {
    const entries = await queryEntries({ entity_type: ent, period, year: period ? undefined : targetYear });
    const income  = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount_taxed, 0);
    const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount_taxed, 0);
    const taxOutput = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.tax_amount, 0);
    const taxInput  = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.tax_amount, 0);
    const byCategory: Record<string, number> = {};
    entries.forEach(e => { byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_taxed; });
    const deductCats = ['medical', 'education', 'life_insurance', 'house_rent'];
    const deductible_items = ent === 'family'
      ? deductCats.map(cat => ({ category: cat, amount: byCategory[cat] ?? 0 })).filter(d => d.amount > 0)
      : undefined;
    return {
      entity_type: ent, entity_label: entityLabel(ent), period: period ?? `${targetYear}年`,
      entry_count: entries.length, total_income: income, total_expense: expense,
      net_profit_loss: income - expense, tax_output: taxOutput, tax_input: taxInput,
      net_tax: taxOutput - taxInput,
      top_categories: Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5),
      ...(deductible_items ? { deductible_items } : {}),
    };
  }));
  res.json({ generated_at: new Date().toISOString(), query: { entity: entity ?? 'all', period, year: targetYear }, entities: results });
});

// ── POST /agents/accountant/taxplan ── AI 節稅規劃 ───────────────
accountantRouter.post('/taxplan', async (req: Request, res: Response) => {
  const { year, mode } = req.body as { year?: number; mode?: string };
  const targetYear = year ?? new Date().getFullYear();
  const [companyEntries, personalEntries, familyEntries] = await Promise.all([
    queryEntries({ entity_type: 'co_construction', year: targetYear }),
    queryEntries({ entity_type: 'personal', year: targetYear }),
    queryEntries({ entity_type: 'family', year: targetYear }),
  ]);
  function sumEnt(entries: LedgerEntry[]) {
    const income  = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount_taxed, 0);
    const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount_taxed, 0);
    const byCategory: Record<string, number> = {};
    entries.forEach(e => { byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_taxed; });
    return { income, expense, net: income - expense, byCategory };
  }
  const cS = sumEnt(companyEntries);
  const pS = sumEnt(personalEntries);
  const fS = sumEnt(familyEntries);
  const deductionLimits: Record<string, number> = { medical: 200000, education: 25000, life_insurance: 24000, house_rent: 120000 };
  const deductions = Object.entries(deductionLimits).map(([cat, limit]) => ({
    category: cat, actual: fS.byCategory[cat] ?? 0, limit, claimable: Math.min(fS.byCategory[cat] ?? 0, limit),
  }));
  const totalDeductible = deductions.reduce((s, d) => s + d.claimable, 0);

  if (mode === 'deduct') {
    res.json({ mode: 'deduct', year: targetYear, deductions, total_deductible: totalDeductible,
      note: '以上為依帳本資料估算，實際申報以收據/單據為準' }); return;
  }

  let ragContext = '（法規資料庫未連線，以通用知識回答）';
  try {
    const topics = ['個人綜合所得稅扣除額種類與上限', '工程公司費用合理列支節稅方法', '勞健保費用抵稅規定', '小規模營業人稅務優惠條件'];
    const ragResults = await Promise.allSettled(topics.map(t =>
      fetch(`${REGULATION_RAG_URL}/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: t, category: 'tax', top_k: 2 }) }).then(r => r.ok ? r.json() : null)));
    const snippets = ragResults.filter(r => r.status === 'fulfilled' && r.value)
      .map((r, i) => {
        const v = (r as PromiseFulfilledResult<{ results?: Array<{ content: string }> }>).value;
        return `【${topics[i]}】\n${v?.results?.[0]?.content ?? '查無資料'}`;
      });
    if (snippets.length > 0) ragContext = snippets.join('\n\n');
  } catch { /* noop */ }

  const prompt = `你是鳴鑫會計師，15年台灣工程公司會計經驗。請根據以下帳本資料和稅法條文，提供${targetYear}年度個人化節稅規劃建議。

═══ ${targetYear}年度帳本資料 ═══
【公司帳】收入 NT$${cS.income.toLocaleString()} | 支出 NT$${cS.expense.toLocaleString()} | 損益 NT$${cS.net.toLocaleString()}
主要支出：${Object.entries(cS.byCategory).filter(([,v])=>v>0).map(([k,v])=>`${k}:NT$${v.toLocaleString()}`).join(', ')}

【個人帳】所得 NT$${pS.income.toLocaleString()} | 支出 NT$${pS.expense.toLocaleString()}

【家庭可申報扣除額】
${deductions.filter(d=>d.actual>0).map(d=>`  ${d.category}:實際NT$${d.actual.toLocaleString()},可申報NT$${d.claimable.toLocaleString()}(上限${d.limit.toLocaleString()})`).join('\n')}
合計可申報：NT$${totalDeductible.toLocaleString()}

═══ 相關稅法 ═══
${ragContext}

請分三區塊輸出：
1.【公司面節稅】節稅機會與風險提醒（引用稅法條文）
2.【個人面節稅】薪資扣除、綜所稅規劃
3.【建議行動清單】3-5項具體步驟+預估省稅金額

繁體中文，嚴謹且親切。最後加⚠️風險提醒。`;

  try {
    const { content: cleanedPlanA, latency_ms: latencyA } = await ollamaChat(
      [{ role: 'user', content: prompt }],
      MODEL,
      { temperature: 0.1, num_predict: 3000 },
    );
    const finalPlanA = cleanedPlanA.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    res.json({
      ok: true, year: targetYear, generated_at: new Date().toISOString(),
      latency_ms: latencyA, privacy_level: 'PRIVATE', model: MODEL,
      data_summary: {
        company: { income: cS.income, expense: cS.expense, net: cS.net },
        personal: { income: pS.income, expense: pS.expense },
        family: { deductible_total: totalDeductible, deductions },
      },
      plan: finalPlanA,
      disclaimer: '以上建議依帳本資料自動生成，申報前請與稅務機關確認，不構成法律意見。',
    });
  } catch (err) {
    logger.error(`[Taxplan] AI failed: ${String(err)}`);
    res.status(500).json({ error: '節稅規劃 AI 異常', details: String(err) });
  }
});

// CR-02: Removed duplicate Phase 2 routes (lines 976-1258 were exact duplicates of lines 703-974).
