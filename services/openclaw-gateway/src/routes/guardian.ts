/**
 * Guardian Agent Route — 安盾保險顧問幕僚
 *
 * GET  /agents/guardian/health                  — Agent 狀態
 * POST /agents/guardian/chat                    — 自由問答（保險諮詢）
 * POST /agents/guardian/analyze                 — 三實體保障缺口分析
 * POST /agents/guardian/calc/car                — 工程綜合險費率試算
 * POST /agents/guardian/calc/life               — DIME 法則壽險保額計算
 * POST /agents/guardian/calc/workers            — 職災補償試算（§59）
 * GET  /agents/guardian/calc/premium            — 年度保費彙整
 * POST /agents/guardian/plan/company            — 工程公司全方位保障規劃（AI）
 * POST /agents/guardian/plan/personal           — 個人保障規劃（AI）
 * POST /agents/guardian/plan/family             — 家庭保障規劃（AI）
 * POST /agents/guardian/plan/full               — 三實體統合規劃（AI，最完整）
 * POST /agents/guardian/policy                  — 新增保單記錄
 * GET  /agents/guardian/policy                  — 查詢保單列表
 * DELETE /agents/guardian/policy/:id            — 刪除保單
 * GET  /agents/guardian/report/gap              — 缺口分析報告
 * GET  /agents/guardian/report/premium          — 保費核對帳本
 * POST /agents/guardian/collab/accountant       — 向鳴鑫請求財務資料
 *
 * 設計原則：
 *   - 計算類 (/calc/*) 均為確定性公式，無 LLM，即時回應
 *   - 分析/規劃類強制走本地 qwen3:14b（temperature=0.1）
 *   - Privacy Level 永遠 PRIVATE（保單資料，強制本機）
 *   - 保單號碼僅存後4碼（masked）
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../logger';
import { ollamaChat } from '../ollama-inference.service';
import { guardianSystemPrompt } from '../prompts';
import {
  addPolicy, queryPolicies, getPolicyById, deletePolicy,
  calcPremiumSummary, getMandatoryGap,
  calcCarPremium, calcLifeInsurance, calcWorkersComp,
  markLedgerLinked,
  CATEGORY_ZH, ENTITY_ZH, MANDATORY_CATEGORIES,
  type InsurancePolicy, type PolicyCategory, type EntityType, type PolicyStatus,
} from '../insurance-store';

export const guardianRouter = Router();

const AGENT_ID = 'guardian';
const MODEL = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';
const REGULATION_RAG_URL = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';
const ACCOUNTANT_URL = process.env['OPENCLAW_GATEWAY_URL'] ?? 'http://localhost:3100';


// ── RAG 查詢（保險法規）─────────────────────────────────────────
async function queryInsuranceRag(question: string): Promise<string> {
  try {
    const resp = await fetch(`${REGULATION_RAG_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, category: 'insurance', top_k: 3 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return '';
    const data = await resp.json() as { results?: Array<{ content: string }> };
    return data.results?.map(r => r.content).join('\n\n').slice(0, 1200) ?? '';
  } catch {
    return '';
  }
}

// ── 向鳴鑫取得帳本財務資料（Agent 協作）─────────────────────────
async function fetchAccountantData(entity_type?: EntityType, year?: number): Promise<{
  income: number; expense: number; net: number; salary?: number;
}> {
  try {
    const params = new URLSearchParams({ limit: '200' });
    if (entity_type) params.append('entity_type', entity_type);
    if (year) params.append('year', String(year));

    const resp = await fetch(
      `${ACCOUNTANT_URL}/agents/accountant/ledger?${params}`,
      {
        headers: { 'Authorization': 'Bearer dev-local-bypass' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!resp.ok) return { income: 0, expense: 0, net: 0 };
    const data = await resp.json() as { summary: { total_income: number; total_expense: number; net: number } };
    return {
      income: data.summary.total_income,
      expense: data.summary.total_expense,
      net: data.summary.net,
      salary: entity_type === 'personal' ? data.summary.total_income : undefined,
    };
  } catch {
    return { income: 0, expense: 0, net: 0 };
  }
}

function handleGuardianError(req: Request, res: Response, contextMsg: string, err: unknown) {
  const traceId = crypto.randomUUID();
  logger.error(`[Guardian] ${contextMsg} Error: ${err}`, {
    traceId,
    method: req.method,
    url: req.originalUrl,
    bodySummary: req.body ? Object.keys(req.body) : undefined,
    stack: err instanceof Error ? err.stack : undefined
  });
  res.status(500).json({
    ok: false,
    error: 'AGENT_SERVICE_FAILURE',
    message: contextMsg,
    details: err instanceof Error ? err.message : String(err),
    resolution: 'Please verify Ollama/Firebase availability and try again later.',
    trace_id: traceId
  });
}

// ============================================================
// ── GET /agents/guardian/health ─────────────────────────────
// ============================================================
/**
 * @openapi
 * /agents/guardian/health:
 *   get:
 *     tags: [Guardian (安盾)]
 *     summary: Guardian Agent 健康檢查
 *     description: 回傳 Guardian Agent 狀態、模型、推理路由、RAG 可用性與能力清單
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: Agent 狀態正常
 *         content:
 *           application/json:
 *             example:
 *               agent_id: guardian
 *               status: ready
 *               model: qwen3:14b
 *               inference_route: local
 *               privacy_level: PRIVATE
 *               rag_status: online
 */
guardianRouter.get('/health', async (_req: Request, res: Response) => {
  let ragStatus = 'offline';
  try {
    const r = await fetch(`${REGULATION_RAG_URL}/health`, { signal: AbortSignal.timeout(2000) });
    ragStatus = r.ok ? 'online' : 'degraded';
  } catch { /* offline */ }

  res.json({
    agent_id: AGENT_ID,
    display_name: 'Shield 🐢 (Guardian)',
    mascot: '🐢 玄武',
    status: 'ready',
    model: MODEL,
    inference_route: 'local',
    privacy_level: 'PRIVATE',
    rag_status: ragStatus,
    capabilities: [
      'chat', 'analyze',
      'calc_car', 'calc_pli', 'calc_life', 'calc_workers', 'calc_premium',
      'plan_company', 'plan_personal', 'plan_family', 'plan_full',
      'policy_crud', 'report_gap', 'report_premium',
      'collab_accountant',
    ],
    collab_agents: ['accountant', 'daredevil'],
  });
});

// ============================================================
// ── POST /agents/guardian/chat ──────────────────────────────
// ============================================================
/**
 * @openapi
 * /agents/guardian/chat:
 *   post:
 *     tags: [Guardian (安盾)]
 *     summary: 保險諮詢問答（AI）
 *     description: 與安盾進行自由問答，支援保險法規 RAG 查詢，強制走本地 Ollama qwen3:14b
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AgentChatRequest'
 *           example:
 *             message: 工程公司需要投保哪些強制保險？
 *             context: 從事建築改造，員工12人
 *     responses:
 *       200:
 *         description: AI 回覆
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentChatResponse'
 *       400:
 *         description: 缺少 message
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
guardianRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, context } = req.body as { message?: string; context?: string };
  if (!message?.trim()) { res.status(400).json({ error: 'message required' }); return; }

  const traceId = crypto.randomUUID();

  // 可選 RAG 查詢
  let ragContext = '';
  if (/保險|保單|保額|理賠|保費|投保|意外|壽險|醫療|職災|工程險|公共責任/.test(message)) {
    ragContext = await queryInsuranceRag(message);
  }

  const userContent = ragContext
    ? `【相關保險法規（自動擷取）】\n${ragContext}\n\n---\n\n【諮詢問題】${message}${context ? `\n\n【背景】${context}` : ''}`
    : `${message}${context ? `\n\n【背景資訊】${context}` : ''}`;

  try {
    const { content: reply, latency_ms } = await ollamaChat(
      [
        { role: 'system', content: guardianSystemPrompt.template },
        { role: 'user', content: userContent },
      ],
      MODEL,
      { temperature: 0.1, num_predict: 2048 },
    );

    logger.info(`[Guardian/chat] trace=${traceId} latency=${latency_ms}ms rag=${ragContext ? 'hit' : 'none'}`);
    res.json({
      agent_id: AGENT_ID, model: MODEL,
      inference_route: 'local', privacy_level: 'PRIVATE',
      rag_used: ragContext ? 'insurance' : null,
      trace_id: traceId, latency_ms,
      reply: reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
    });
  } catch (err) {
    handleGuardianError(req, res, '保險諮詢 AI 異常', err);
  }
});

// ============================================================
// ── POST /agents/guardian/calc/car ──────────────────────────
// ── 工程保險費率試算（確定性計算，無 LLM）───────────────────
// ============================================================
/**
 * @openapi
 * /agents/guardian/calc/car:
 *   post:
 *     tags: [Guardian (安盾)]
 *     summary: 工程綜合保險費率試算 (CAR)
 *     description: 依工程合約金額、工期、人數試算工程綜合保險（CAR）＋公共責任險（PLI）＋職災保費，純公式計算無 LLM
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contract_value, duration_months, workers]
 *             properties:
 *               contract_value: { type: number, example: 8500000, description: '工程合約金額（NT$）' }
 *               duration_months: { type: integer, example: 18, description: '工期（月）' }
 *               workers: { type: integer, example: 12, description: '施工人員數' }
 *               project_name: { type: string, example: '台積電廠房整修工程' }
 *               complexity: { type: string, enum: [low, medium, high], default: medium }
 *     responses:
 *       200:
 *         description: 試算結果（含 CAR、PLI、職災分項保費）
 *       400:
 *         description: 缺少必要參數
 */
guardianRouter.post('/calc/car', async (req: Request, res: Response) => {
  const { contract_value, duration_months, workers, project_name, complexity } = req.body as {
    contract_value?: number; duration_months?: number; workers?: number;
    project_name?: string; complexity?: 'low' | 'medium' | 'high';
  };

  if (!contract_value || contract_value <= 0 || !duration_months || !workers) {
    res.status(400).json({
      error: 'contract_value, duration_months, workers are required',
      example: {
        contract_value: 8500000,
        duration_months: 18,
        workers: 12,
        project_name: '台積電廠房整修工程',
        complexity: 'medium',
      },
    });
    return;
  }

  const result = calcCarPremium({ contract_value, duration_months, workers, project_name, complexity });
  logger.info(`[Guardian/calc/car] contract=${contract_value} workers=${workers} total=${result.total_annual_premium}`);

  res.json({
    ok: true,
    calc_type: 'engineering_insurance',
    ...result,
    summary_message: `工程保費估算：年繳約 NT$${result.total_annual_premium.toLocaleString()}（CAR+PLI+職災），工期 ${duration_months} 個月合計約 NT$${(result.car_premium + result.pli_premium).toLocaleString()}`,
  });
});

// ── POST /agents/guardian/calc/life ─────────────────────────
/**
 * @openapi
 * /agents/guardian/calc/life:
 *   post:
 *     tags: [Guardian (安盾)]
 *     summary: DIME 法則壽險保額計算
 *     description: 依 DIME 法則（Debt × Income × Mortgage × Education）計算建議最低壽險保額
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [annual_salary]
 *             properties:
 *               annual_salary: { type: number, example: 1440000 }
 *               debts: { type: number, example: 500000 }
 *               income_years: { type: integer, example: 20 }
 *               mortgage: { type: number, example: 8000000 }
 *               children: { type: integer, example: 2 }
 *               education_per_child: { type: number, example: 1200000 }
 *     responses:
 *       200:
 *         description: 建議壽險保額與月繳估算
 *       400:
 *         description: 缺少 annual_salary
 */
guardianRouter.post('/calc/life', async (req: Request, res: Response) => {
  const { annual_salary, debts, income_years, mortgage, children, education_per_child } = req.body as {
    annual_salary?: number; debts?: number; income_years?: number;
    mortgage?: number; children?: number; education_per_child?: number;
  };

  if (!annual_salary || annual_salary <= 0) {
    res.status(400).json({
      error: 'annual_salary required',
      example: { annual_salary: 1440000, debts: 500000, mortgage: 8000000, children: 2 },
    });
    return;
  }

  const result = calcLifeInsurance({ annual_salary, debts, income_years, mortgage, children, education_per_child });
  logger.info(`[Guardian/calc/life] salary=${annual_salary} coverage=${result.recommended_coverage}`);

  res.json({
    ok: true, calc_type: 'life_insurance_dime', ...result,
    summary_message: `建議壽險保額 NT$${result.recommended_coverage.toLocaleString()}，定期壽險月繳估算 NT$${result.monthly_premium_estimate.toLocaleString()}`,
    legal_basis: '依 DIME 法則（Debt×Income×Mortgage×Education）計算最低保障需求',
  });
});

// ── POST /agents/guardian/calc/workers ──────────────────────
/**
 * @openapi
 * /agents/guardian/calc/workers:
 *   post:
 *     tags: [Guardian (安盾)]
 *     summary: 職災補償試算（勞基法§59）
 *     description: 按月薪與人數試算最高職災補償總額（醫療費+工資補償+失能補償+死亡補償），無 LLM
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [monthly_salary]
 *             properties:
 *               monthly_salary: { type: number, example: 45000 }
 *               workers: { type: integer, example: 12 }
 *     responses:
 *       200:
 *         description: 職災補償試算結果
 */
guardianRouter.post('/calc/workers', async (req: Request, res: Response) => {
  const { monthly_salary, workers } = req.body as { monthly_salary?: number; workers?: number };

  if (!monthly_salary || monthly_salary <= 0) {
    res.status(400).json({
      error: 'monthly_salary required',
      example: { monthly_salary: 45000, workers: 12 },
    });
    return;
  }

  const result = calcWorkersComp({ monthly_salary, workers });
  logger.info(`[Guardian/calc/workers] salary=${monthly_salary} workers=${workers} worst=${result.worst_case_total}`);

  res.json({ ok: true, calc_type: 'workers_compensation', ...result });
});

// ── GET /agents/guardian/calc/premium ───────────────────────
/**
 * @openapi
 * /agents/guardian/calc/premium:
 *   get:
 *     tags: [Guardian (安盾)]
 *     summary: 年度保費彙整（各實體分類）
 *     description: 彙整所有有效保單的年繳保費，依實體類型（公司/個人/家庭）分組統計
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: 年度保費彙整結果
 */
guardianRouter.get('/calc/premium', async (_req: Request, res: Response) => {
  const summary = await calcPremiumSummary();
  res.json({ ok: true, ...summary });
});

// ============================================================
// ── POST /agents/guardian/analyze ───────────────────────────
// ── 三實體保障缺口分析（AI + 帳本整合）─────────────────────
// ============================================================
/**
 * @openapi
 * /agents/guardian/analyze:
 *   post:
 *     tags: [Guardian (安盾)]
 *     summary: 三實體保障缺口分析（AI）
 *     description: 整合帳本財務數據＋現有保單＋法規 RAG，由 AI 分析公司/個人/家庭的全方位保障缺口
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               year: { type: integer, example: 2026, description: '分析年度（預設當年）' }
 *     responses:
 *       200:
 *         description: 三實體保障缺口分析報告
 *       500:
 *         description: AI 推理異常
 */
guardianRouter.post('/analyze', async (req: Request, res: Response) => {
  const { year } = req.body as { year?: number };
  const targetYear = year ?? new Date().getFullYear();
  const traceId = crypto.randomUUID();

  logger.info(`[Guardian/analyze] year=${targetYear} trace=${traceId}`);

  // Step 1: 並行取得帳本數據 + 保單清單 + 強制缺口
  const [coData, peData, faData, activePolicies, mandatoryGap] = await Promise.all([
    fetchAccountantData('co_construction', targetYear),
    fetchAccountantData('personal', targetYear),
    fetchAccountantData('family', targetYear),
    queryPolicies({ status: 'active', limit: 200 }),
    getMandatoryGap(),
  ]);

  // Step 2: RAG 法規查詢
  const ragContext = await queryInsuranceRag('工程公司必備保險 個人壽險規劃 職災補償');

  // Step 3: 建立分析 prompt
  const activeSummary = activePolicies.slice(0, 20).map(p =>
    `${CATEGORY_ZH[p.category]} | ${p.insurer} | 保額 NT$${p.sum_insured.toLocaleString()} | 年繳 NT$${p.annual_premium.toLocaleString()}`
  ).join('\n') || '（尚未登錄任何保單）';

  const mandatoryMissing = mandatoryGap.missing.map(c => `⚠️ 強制缺失：${CATEGORY_ZH[c]}`).join('\n') || '（強制保險全數到位）';
  const totalPremium = activePolicies.reduce((s, p) => s + p.annual_premium, 0);

  // 壽險保額合理性檢查
  const lifePolicies = activePolicies.filter(p => p.category === 'life_term' || p.category === 'life_whole');
  const totalLifeCoverage = lifePolicies.reduce((s, p) => s + p.sum_insured, 0);
  const recommendedLifeCoverage = peData.salary ? peData.salary * 10 : 0;

  const prompt = `${guardianSystemPrompt.template}

---
【年度財務背景（${targetYear}年）】
🏢 公司：年收入 NT$${coData.income.toLocaleString()} | 年支出 NT$${coData.expense.toLocaleString()} | 淨利 NT$${coData.net.toLocaleString()}
👤 個人：年薪 NT$${peData.income.toLocaleString()} | 其他支出 NT$${peData.expense.toLocaleString()}
🏠 家庭：家庭支出 NT$${faData.expense.toLocaleString()}

【已登錄保單（共 ${activePolicies.length} 張，年繳合計 NT$${totalPremium.toLocaleString()}）】
${activeSummary}

【強制保險核查】
${mandatoryMissing}
${mandatoryGap.present.map(c => `✅ ${CATEGORY_ZH[c]}`).join('\n')}

【壽險保額參考】
現有壽險保額合計: NT$${totalLifeCoverage.toLocaleString()}
DIME 建議最低保額: NT$${recommendedLifeCoverage.toLocaleString()}（年薪×10倍）
${totalLifeCoverage < recommendedLifeCoverage ? `⚠️ 缺口 NT$${(recommendedLifeCoverage - totalLifeCoverage).toLocaleString()}` : '✅ 壽險保額符合建議'}

【相關法規】
${ragContext}

---
請輸出完整的三實體保障缺口分析，依以下格式：

1.【強制缺口警示】法定強制保險缺失（最高優先）
2.【工程公司缺口】依年收入評估所需保障vs現況
3.【個人缺口】壽險/失能/醫療缺口分析
4.【家庭缺口】住宅/長照/子女缺口分析
5.【優先行動清單】依風險等級排序的 5 項行動（含緊急/建議/可選）
6.⚠️ 風險聲明

繁體中文，數字精確，引用法規出處。`;

  try {
    const { content, latency_ms } = await ollamaChat(
      [{ role: 'user', content: prompt }],
      MODEL,
      { temperature: 0.1, num_predict: 3000 },
    );

    const analysis = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    res.json({
      ok: true, year: targetYear, trace_id: traceId,
      latency_ms, privacy_level: 'PRIVATE', model: MODEL,
      data_summary: {
        company: coData, personal: peData, family: faData,
        active_policies: activePolicies.length,
        total_annual_premium: totalPremium,
        mandatory_missing: mandatoryGap.missing,
        mandatory_present: mandatoryGap.present,
        life_coverage: { current: totalLifeCoverage, recommended: recommendedLifeCoverage },
      },
      analysis,
      disclaimer: '以上分析依帳本資料自動生成，實際投保需諮詢持照保險業務員，不構成法律或投保建議。',
    });
  } catch (err) {
    handleGuardianError(req, res, '缺口分析 AI 異常', err);
  }
});

// ============================================================
// ── POST /agents/guardian/plan/* ────────────────────────────
// ── AI 保障規劃（company / personal / family / full）────────
// ============================================================

async function generatePlan(
  entity: EntityType | 'full',
  context: Record<string, unknown>,
  traceId: string,
) {
  const ragContext = await queryInsuranceRag(
    entity === 'co_construction' ? '工程公司保險規劃 公共責任 職災 工程險'
      : entity === 'personal' ? '個人壽險醫療失能規劃 DIME 重大傷病'
      : entity === 'family' ? '家庭保障住宅火險地震長照汽車'
      : '工程公司個人家庭整合保障規劃',
  );

  const entityName = entity === 'co_construction' ? '工程公司'
    : entity === 'personal' ? '個人'
    : entity === 'family' ? '家庭'
    : '三實體整合（公司+個人+家庭）';

  const prompt = `${guardianSystemPrompt.template}

---
【規劃對象】${entityName}
【財務背景】${JSON.stringify(context, null, 2)}
【相關法規】${ragContext || '（RAG 未回應）'}

請為【${entityName}】輸出完整保障規劃：

**現況評估**（依財務數據分析現有保障水準）
**建議險種配置**（每種險種：承保目的、建議保額、預估年繳保費、優先級 高/中/低）
**費用規劃**（建議保費佔收入/薪資的比例分析）
**行動清單**（3-5項具體步驟，含時程建議）
⚠️ 風險提示

繁體中文，數字精確，引用相關法規。`;

  const { content, latency_ms } = await ollamaChat(
    [{ role: 'user', content: prompt }],
    MODEL,
    { temperature: 0.1, num_predict: 3000 },
  );

  return {
    plan: content.replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
    latency_ms,
  };
}

/**
 * @openapi
 * /agents/guardian/plan/company:
 *   post:
 *     tags: [Guardian (安盾)]
 *     summary: 工程公司全方位保障規劃（AI）
 *     description: 整合帳本數據，由 AI 生成工程公司量身保障規劃（強制險＋建議險＋費用分配）
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               annual_revenue: { type: number, example: 5000000 }
 *               workers: { type: integer, example: 12 }
 *     responses:
 *       200:
 *         description: 公司保障規劃報告（AI 生成）
 */
guardianRouter.post('/plan/company', async (req: Request, res: Response) => {
  const { annual_revenue, workers, projects } = req.body as {
    annual_revenue?: number; workers?: number; projects?: Array<{name: string; value: number}>;
  };
  const traceId = crypto.randomUUID();
  const [coData, activePolicies] = await Promise.all([
    fetchAccountantData('co_construction'),
    queryPolicies({ status: 'active', limit: 100 }),
  ]);
  const context = {
    annual_revenue: annual_revenue ?? coData.income,
    annual_expense: coData.expense, net_profit: coData.net,
    workers: workers ?? 0,
    active_policies: activePolicies.filter(p => p.entity_type === 'co_construction').length,
    current_premium: activePolicies.filter(p => p.entity_type === 'co_construction')
      .reduce((s, p) => s + p.annual_premium, 0),
    projects: projects ?? [],
  };
  try {
    const { plan, latency_ms } = await generatePlan('co_construction', context, traceId);
    res.json({ ok: true, entity: 'co_construction', trace_id: traceId, latency_ms, privacy_level: 'PRIVATE', plan,
      disclaimer: '規劃建議依帳本資料自動生成，實際投保請諮詢持照業務員，不構成保險建議。' });
  } catch (err) {
    handleGuardianError(req, res, '規劃 AI 異常', err);
  }
});

/**
 * @openapi
 * /agents/guardian/plan/personal:
 *   post:
 *     tags: [Guardian (安盾)]
 *     summary: 個人保障規劃（AI）
 *     description: 依個人薪資、負債、房貸、子女數，整合 DIME 法則與現有保單，由 AI 生成個人保障規劃
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               annual_salary: { type: number, example: 1440000 }
 *               debts: { type: number }
 *               mortgage: { type: number }
 *               children: { type: integer }
 *               age: { type: integer }
 *     responses:
 *       200:
 *         description: 個人保障規劃（AI 生成，含 DIME 摘要）
 */
guardianRouter.post('/plan/personal', async (req: Request, res: Response) => {
  const { annual_salary, debts, mortgage, children, age } = req.body as {
    annual_salary?: number; debts?: number; mortgage?: number; children?: number; age?: number;
  };
  const traceId = crypto.randomUUID();
  const [peData, activePolicies] = await Promise.all([
    fetchAccountantData('personal'),
    queryPolicies({ entity_type: 'personal', status: 'active', limit: 100 }),
  ]);
  const salary = annual_salary ?? peData.income;
  const dime = salary > 0 ? calcLifeInsurance({ annual_salary: salary, debts, mortgage, children }) : null;

  const context = {
    annual_salary: salary, age, debts, mortgage, children,
    dime_minimum_coverage: dime?.minimum_coverage,
    dime_recommended_coverage: dime?.recommended_coverage,
    active_personal_policies: activePolicies.length,
    current_premium: activePolicies.reduce((s, p) => s + p.annual_premium, 0),
    policy_list: activePolicies.map(p => `${CATEGORY_ZH[p.category]} NT$${p.sum_insured.toLocaleString()}`),
  };
  try {
    const { plan, latency_ms } = await generatePlan('personal', context, traceId);
    res.json({ ok: true, entity: 'personal', trace_id: traceId, latency_ms, privacy_level: 'PRIVATE', plan,
      dime_summary: dime, disclaimer: '規劃建議依帳本資料自動生成，實際投保請諮詢持照業務員。' });
  } catch (err) {
    handleGuardianError(req, res, '規劃 AI 異常', err);
  }
});

/**
 * @openapi
 * /agents/guardian/plan/family:
 *   post:
 *     tags: [Guardian (安盾)]
 *     summary: 家庭保障規劃（AI）
 *     description: 依家庭成員、房屋價值、車輛數量，由 AI 生成住宅/長照/子女等家庭保障規劃
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               members: { type: integer, example: 4 }
 *               house_value: { type: number, example: 10000000 }
 *               mortgage: { type: number }
 *               vehicle_count: { type: integer }
 *     responses:
 *       200:
 *         description: 家庭保障規劃（AI 生成）
 */
guardianRouter.post('/plan/family', async (req: Request, res: Response) => {
  const { members, house_value, mortgage, vehicle_count } = req.body as {
    members?: number; house_value?: number; mortgage?: number; vehicle_count?: number;
  };
  const traceId = crypto.randomUUID();
  const [faData, activePolicies] = await Promise.all([
    fetchAccountantData('family'),
    queryPolicies({ entity_type: 'family', status: 'active', limit: 100 }),
  ]);
  const context = {
    members, house_value, mortgage, vehicle_count,
    annual_family_expense: faData.expense,
    active_family_policies: activePolicies.length,
    current_premium: activePolicies.reduce((s, p) => s + p.annual_premium, 0),
    policy_list: activePolicies.map(p => `${CATEGORY_ZH[p.category]} NT$${p.sum_insured.toLocaleString()}`),
  };
  try {
    const { plan, latency_ms } = await generatePlan('family', context, traceId);
    res.json({ ok: true, entity: 'family', trace_id: traceId, latency_ms, privacy_level: 'PRIVATE', plan,
      disclaimer: '規劃建議自動生成，不構成保險建議。' });
  } catch (err) {
    handleGuardianError(req, res, '規劃 AI 異常', err);
  }
});

/**
 * @openapi
 * /agents/guardian/plan/full:
 *   post:
 *     tags: [Guardian (安盾)]
 *     summary: 三實體統合保障規劃（AI，最完整）
 *     description: 整合公司＋個人＋家庭的全量帳本數據及現有保單，由 AI 產出最完整的跨實體統合保障規劃
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               year: { type: integer, example: 2026 }
 *     responses:
 *       200:
 *         description: 三實體統合規劃報告（AI 生成）
 */
guardianRouter.post('/plan/full', async (req: Request, res: Response) => {
  const { year } = req.body as { year?: number };
  const targetYear = year ?? new Date().getFullYear();
  const traceId = crypto.randomUUID();

  const [coData, peData, faData, activePolicies] = await Promise.all([
    fetchAccountantData('co_construction', targetYear),
    fetchAccountantData('personal', targetYear),
    fetchAccountantData('family', targetYear),
    queryPolicies({ status: 'active', limit: 200 }),
  ]);

  const totalPremium = activePolicies.reduce((s, p) => s + p.annual_premium, 0);
  const context = {
    year: targetYear,
    company: coData, personal: peData, family: faData,
    total_active_policies: activePolicies.length,
    total_annual_premium: totalPremium,
    by_entity: {
      company: activePolicies.filter(p => p.entity_type === 'co_construction').length,
      personal: activePolicies.filter(p => p.entity_type === 'personal').length,
      family: activePolicies.filter(p => p.entity_type === 'family').length,
    },
  };

  try {
    const { plan, latency_ms } = await generatePlan('full', context, traceId);
    res.json({
      ok: true, year: targetYear, entity: 'full', trace_id: traceId,
      latency_ms, privacy_level: 'PRIVATE', model: MODEL, plan,
      data_summary: context,
      disclaimer: '三實體整合規劃依帳本資料自動生成，實際投保請諮詢持照業務員，不構成保險建議。',
    });
  } catch (err) {
    handleGuardianError(req, res, '統合規劃 AI 異常', err);
  }
});

// ============================================================
// ── 保單 CRUD ────────────────────────────────────────────────
// ── POST /agents/guardian/policy — 新增保單 ─────────────────
// ============================================================
/**
 * @openapi
 * /agents/guardian/policy:
 *   post:
 *     tags: [Guardian (安盾)]
 *     summary: 新增保單記錄
 *     description: 登錄新保單至 Guardian 保單庫（保單號碼僅存後4碼）
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entity_type, category, insurer, insured_name, sum_insured, annual_premium, start_date]
 *             properties:
 *               entity_type: { type: string, enum: [personal, family, co_construction, co_renovation, co_design, co_drone, assoc_rescue] }
 *               category: { type: string, example: workers_comp, description: '保單類別（見 CATEGORY_ZH）' }
 *               insurer: { type: string, example: 新光產險 }
 *               insured_name: { type: string, example: 張大明 }
 *               sum_insured: { type: number, example: 5000000 }
 *               annual_premium: { type: number, example: 24000 }
 *               start_date: { type: string, format: date, example: '2026-01-01' }
 *     responses:
 *       201:
 *         description: 保單登錄成功
 *       400:
 *         description: 缺少必要欄位
 *   get:
 *     tags: [Guardian (安盾)]
 *     summary: 查詢保單列表
 *     description: 依實體類型、保單類別、狀態篩選保單，含保費彙總
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: entity_type
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, expired, cancelled], default: active }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200:
 *         description: 保單列表（含彙總統計）
 */
guardianRouter.post('/policy', async (req: Request, res: Response) => {
  const {
    entity_type, category, insurer, policy_no_masked, insured_name, beneficiary,
    sum_insured, annual_premium, payment_frequency = 'annual',
    start_date, end_date = 'lifetime', is_mandatory = false,
    project_id, project_name, notes,
  } = req.body as Partial<InsurancePolicy>;

  if (!entity_type || !category || !insurer || !insured_name || !sum_insured || !annual_premium || !start_date) {
    res.status(400).json({
      error: 'entity_type, category, insurer, insured_name, sum_insured, annual_premium, start_date required',
      categories: Object.keys(CATEGORY_ZH),
      entity_types: ['personal','family','co_drone','co_construction','co_renovation','co_design','assoc_rescue'],
    });
    return;
  }

  const policy: InsurancePolicy = {
    policy_id: crypto.randomUUID(),
    entity_type, category, insurer,
    policy_no_masked: policy_no_masked ?? '****',
    insured_name, beneficiary,
    sum_insured, annual_premium,
    payment_frequency,
    start_date, end_date,
    is_mandatory: is_mandatory || MANDATORY_CATEGORIES.includes(category),
    status: 'active',
    project_id, project_name, notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ledger_linked: false,
  };

  await addPolicy(policy);
  logger.info(`[Guardian/policy] Added ${category} ${insurer} entity=${entity_type} premium=${annual_premium}`);

  res.status(201).json({
    ok: true,
    policy_id: policy.policy_id,
    summary: {
      category_zh: CATEGORY_ZH[category],
      entity_label: ENTITY_ZH[entity_type],
      insurer, insured_name, sum_insured, annual_premium,
      start_date, end_date, status: 'active',
    },
    message: `保單已登錄：${ENTITY_ZH[entity_type]} - ${CATEGORY_ZH[category]}（${insurer}）`,
    ledger_tip: `💡 保費可同步至帳本：/acc ledger add expense life_insurance ${annual_premium} ${insurer}年繳保費 ${entity_type}`,
  });
});

// ── GET /agents/guardian/policy — 查詢保單 ──────────────────
guardianRouter.get('/policy', async (req: Request, res: Response) => {
  const { entity_type, category, status, project_id, limit } =
    req.query as Record<string, string | undefined>;

  const policies = await queryPolicies({
    entity_type: entity_type as EntityType,
    category: category as PolicyCategory,
    status: (status ?? 'active') as PolicyStatus,
    project_id,
    limit: limit ? parseInt(limit) : 100,
  });

  const totalPremium = policies.reduce((s, p) => s + p.annual_premium, 0);
  const totalCoverage = policies.reduce((s, p) => s + p.sum_insured, 0);

  res.json({
    count: policies.length,
    summary: {
      total_annual_premium: totalPremium,
      total_sum_insured: totalCoverage,
      by_entity: (['personal', 'family', 'co_drone', 'co_construction', 'co_renovation', 'co_design', 'assoc_rescue'] as EntityType[]).map(et => ({
        entity_type: et,
        entity_label: ENTITY_ZH[et],
        count: policies.filter(p => p.entity_type === et).length,
        annual_premium: policies.filter(p => p.entity_type === et).reduce((s, p) => s + p.annual_premium, 0),
      })),
    },
    policies: policies.map(p => ({
      ...p,
      category_zh: CATEGORY_ZH[p.category],
      entity_label: ENTITY_ZH[p.entity_type],
    })),
  });
});

// ── DELETE /agents/guardian/policy/:id ──────────────────────
/**
 * @openapi
 * /agents/guardian/policy/{id}:
 *   delete:
 *     tags: [Guardian (安盾)]
 *     summary: 刪除保單
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 保單已刪除
 *       404:
 *         description: 保單不存在
 */
guardianRouter.delete('/policy/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const existed = await deletePolicy(id);
  if (!existed) { res.status(404).json({ error: 'Policy not found' }); return; }
  logger.info(`[Guardian/policy] Deleted ${id}`);
  res.json({ ok: true, policy_id: id, message: '保單已刪除' });
});

// ============================================================
// ── GET /agents/guardian/report/gap — 缺口分析報告 ──────────
// ============================================================
/**
 * @openapi
 * /agents/guardian/report/gap:
 *   get:
 *     tags: [Guardian (安盾)]
 *     summary: 保障缺口分析報告
 *     description: 靜態規則比對現有保單，生成缺口評分、行動優先序與強制合規狀態（無 LLM）
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: 缺口分析報告（含評分、CRITICAL/HIGH/OK 告警等級）
 */
guardianRouter.get('/report/gap', async (_req: Request, res: Response) => {
  const [activePolicies, mandatoryGap, coData, peData] = await Promise.all([
    queryPolicies({ status: 'active', limit: 200 }),
    getMandatoryGap(),
    fetchAccountantData('co_construction'),
    fetchAccountantData('personal'),
  ]);

  const activeCategories = new Set(activePolicies.map(p => p.category));
  const totalPremium = activePolicies.reduce((s, p) => s + p.annual_premium, 0);

  // 工程公司推薦必備清單
  const COMPANY_RECOMMENDED: Array<{ cat: PolicyCategory; priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' }> = [
    { cat: 'workers_comp', priority: 'CRITICAL' },
    { cat: 'pli', priority: 'CRITICAL' },
    { cat: 'car_insurance', priority: 'HIGH' },
    { cat: 'employers_liability', priority: 'HIGH' },
    { cat: 'equipment', priority: 'MEDIUM' },
  ];

  // 個人推薦清單
  const PERSONAL_RECOMMENDED: Array<{ cat: PolicyCategory; priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' }> = [
    { cat: 'life_term', priority: 'CRITICAL' },
    { cat: 'accident', priority: 'HIGH' },
    { cat: 'medical', priority: 'HIGH' },
    { cat: 'disability', priority: 'MEDIUM' },
    { cat: 'critical_illness', priority: 'MEDIUM' },
  ];

  // 計算缺口
  const gapItems = [
    ...COMPANY_RECOMMENDED.map(r => ({
      entity: '公司',
      category: CATEGORY_ZH[r.cat],
      category_key: r.cat,
      priority: r.priority,
      status: activeCategories.has(r.cat) ? 'covered' : 'gap',
    })),
    ...PERSONAL_RECOMMENDED.map(r => ({
      entity: '個人',
      category: CATEGORY_ZH[r.cat],
      category_key: r.cat,
      priority: r.priority,
      status: activeCategories.has(r.cat) ? 'covered' : 'gap',
    })),
  ];

  const criticalGaps = gapItems.filter(g => g.status === 'gap' && g.priority === 'CRITICAL');
  const highGaps = gapItems.filter(g => g.status === 'gap' && g.priority === 'HIGH');
  const coveredCount = gapItems.filter(g => g.status === 'covered').length;

  // 壽險保額缺口
  const lifeCoverage = activePolicies.filter(p => p.category === 'life_term' || p.category === 'life_whole')
    .reduce((s, p) => s + p.sum_insured, 0);
  const recommendedLifeCoverage = peData.income * 10;
  const lifeCoverageGap = Math.max(0, recommendedLifeCoverage - lifeCoverage);

  const overallScore = Math.round((coveredCount / gapItems.length) * 100);
  const prompt = `${guardianSystemPrompt.template}

請針對以下保障缺口與財務狀況，撰寫一段 100~150 字的專業保險顧問質性建議。
【目前得分】${overallScore}分
【強制缺口】${mandatoryGap.missing.map(c => CATEGORY_ZH[c]).join(', ') || '無'}
【重大缺口】${criticalGaps.map(g => g.category).join(', ') || '無'}
【壽險缺口】${lifeCoverageGap > 0 ? `NT$${lifeCoverageGap.toLocaleString()}` : '充足'}`;

  let qualitative_advice = '';
  let latency_ms = 0;
  try {
    const { content, latency_ms: ms } = await ollamaChat([{ role: 'user', content: prompt }], MODEL, { temperature: 0.2, num_predict: 500 });
    qualitative_advice = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    latency_ms = ms;
  } catch (e) {
    qualitative_advice = 'AI 質性建議暫時無法提供。';
  }

  res.json({
    ok: true,
    generated_at: new Date().toISOString(),
    overall_score: overallScore,
    alert_level: criticalGaps.length > 0 ? 'CRITICAL' : highGaps.length > 0 ? 'WARNING' : 'OK',
    gap_summary: {
      critical_gaps: criticalGaps.length,
      high_gaps: highGaps.length,
      covered: coveredCount,
      total_checked: gapItems.length,
    },
    mandatory_compliance: {
      missing: mandatoryGap.missing.map(c => CATEGORY_ZH[c]),
      compliant: mandatoryGap.present.map(c => CATEGORY_ZH[c]),
    },
    life_insurance_gap: {
      current_coverage: lifeCoverage,
      recommended_coverage: recommendedLifeCoverage,
      gap: lifeCoverageGap,
      gap_label: lifeCoverageGap > 0 ? `⚠️ 保額缺口 NT$${lifeCoverageGap.toLocaleString()}` : '✅ 保額充足',
    },
    gap_details: gapItems,
    premium_summary: { total_annual: totalPremium, policies_count: activePolicies.length },
    qualitative_advice,
    latency_ms,
    action_items: [
      ...mandatoryGap.missing.map(c => ({
        priority: 'CRITICAL',
        action: `立即投保：${CATEGORY_ZH[c]}（法定強制）`,
        deadline: '本月內',
      })),
      ...criticalGaps.map(g => ({
        priority: 'CRITICAL',
        action: `補充投保：${g.entity} ${g.category}`,
        deadline: '30天內',
      })),
      ...highGaps.slice(0, 3).map(g => ({
        priority: 'HIGH',
        action: `建議補強：${g.entity} ${g.category}`,
        deadline: '3個月內',
      })),
    ],
  });
});

// ── GET /agents/guardian/report/premium — 保費核對帳本 ──────
/**
 * @openapi
 * /agents/guardian/report/premium:
 *   get:
 *     tags: [Guardian (安盾)]
 *     summary: 保費核對帳本
 *     description: 比對 Guardian 保單年繳保費總額與 Accountant 帳本 life_insurance 科目，偵測差異
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: 保費核對結果（MATCHED / DISCREPANCY）
 */
guardianRouter.get('/report/premium', async (_req: Request, res: Response) => {
  const [premiumSummary, activePolicies] = await Promise.all([
    calcPremiumSummary(),
    queryPolicies({ status: 'active', limit: 200 }),
  ]);

  const ledgerBreakdown: Record<string, number> = {};
  let ledgerTotal = 0;

  try {
    const resp = await fetch(
      `${ACCOUNTANT_URL}/agents/accountant/ledger?limit=500`,
      { headers: { 'Authorization': 'Bearer dev-local-bypass' }, signal: AbortSignal.timeout(5000) },
    );
    if (resp.ok) {
      const data = await resp.json() as { entries: Array<{category: string; type: string; entity_type: string; amount_taxed: number}> };
      if (data.entries) {
        for (const entry of data.entries) {
          if (entry.type === 'expense' && (entry.category === 'life_insurance' || entry.category === 'insurance')) {
             const et = entry.entity_type || 'unknown';
             ledgerBreakdown[et] = (ledgerBreakdown[et] || 0) + entry.amount_taxed;
             ledgerTotal += entry.amount_taxed;
          }
        }
      }
    }
  } catch { /* ignore */ }

  const registeredPremium = premiumSummary.grand_total;
  const delta = Math.abs(ledgerTotal - registeredPremium);

  const entityDiscrepancies = premiumSummary.by_entity.map(e => {
      const ledgerEntityPremium = ledgerBreakdown[e.entity_type] || 0;
      const entityDelta = Math.abs(ledgerEntityPremium - e.total_annual_premium);
      return {
          entity_type: e.entity_type,
          entity_label: e.entity_label,
          registered_premium: e.total_annual_premium,
          ledger_premium: ledgerEntityPremium,
          delta: entityDelta,
          status: entityDelta < 5000 ? 'MATCHED' : 'DISCREPANCY'
      };
  });

  res.json({
    ok: true,
    generated_at: new Date().toISOString(),
    registered_in_guardian: {
      total_annual_premium: registeredPremium,
      policies_count: activePolicies.length,
      by_entity: premiumSummary.by_entity.map(e => ({
        entity_label: e.entity_label,
        count: e.active_count,
        annual_premium: e.total_annual_premium,
      })),
    },
    ledger_insurance: {
      annual_expense: ledgerTotal,
      by_entity: ledgerBreakdown,
      note: '帳本 life_insurance 及 insurance 科目年度支出彙總',
    },
    reconciliation: {
      delta,
      status: delta < 5000 ? 'MATCHED' : 'DISCREPANCY',
      label: delta < 5000
        ? '✅ 帳本與保單記錄相符'
        : `⚠️ 總差異 NT$${delta.toLocaleString()}（可能有未登錄保單）`,
      action: delta > 5000 ? '建議詳查各實體紀錄並使用 /ins policy add 補錄未登錄保單' : null,
      breakdown: entityDiscrepancies,
    },
  });
});

// ── POST /agents/guardian/collab/accountant — Agent 協作 ────
/**
 * @openapi
 * /agents/guardian/collab/accountant:
 *   post:
 *     tags: [Guardian (安盾)]
 *     summary: 向鳴鑫請求財務資料（Agent 協作）
 *     description: Guardian 向 Accountant 請求特定實體與年度的帳本財務彙整數據，用於保障分析
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entity_type: { type: string, description: '法人實體 ID' }
 *               year: { type: integer, example: 2026 }
 *               purpose: { type: string, example: '保障缺口分析' }
 *     responses:
 *       200:
 *         description: 帳本財務彙整數據
 */
guardianRouter.post('/collab/accountant', async (req: Request, res: Response) => {
  const { entity_type, year, purpose } = req.body as {
    entity_type?: EntityType; year?: number; purpose?: string;
  };

  const data = await fetchAccountantData(entity_type, year);
  logger.info(`[Guardian/collab] Fetched ${entity_type ?? 'all'} from Accountant for: ${purpose}`);

  res.json({
    ok: true, source: 'accountant', entity_type, year,
    purpose, data,
    note: '資料來自鳴鑫會計師帳本（PRIVATE, 本地推理）',
  });
});

// ═══════════════════════════════════════════════════════════════
// ── C-1b: Guardian → Accountant 保費自動記帳 ────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * POST /agents/guardian/collab/auto-booking
 *
 * 保單登錄後，自動將年繳保費寫入 Accountant 帳本。
 * 門檻：annual_premium >= NT$5,000 才觸發自動入帳。
 *
 * 流程：
 *   1. Guardian 確認保單存在
 *   2. 透過 QVP 佇列向 Accountant 發送 Write Request
 *   3. Accountant 自動建立 expense (life_insurance/insurance) 帳本記錄
 */
guardianRouter.post('/collab/auto-booking', async (req: Request, res: Response) => {
  const { policy_id } = req.body as { policy_id?: string };

  if (!policy_id) {
    res.status(400).json({ error: 'policy_id is required' });
    return;
  }

  const policy = await getPolicyById(policy_id);
  if (!policy) {
    res.status(404).json({ error: 'Policy not found' });
    return;
  }

  if (policy.ledger_linked) {
    res.json({
      ok: true,
      status: 'already_linked',
      message: `保單 ${policy_id} 已連結帳本，無需重複入帳`,
    });
    return;
  }

  if (policy.annual_premium < 5000) {
    res.status(400).json({
      error: 'Annual premium must be >= NT$5,000 for auto-booking',
      current_premium: policy.annual_premium,
    });
    return;
  }

  try {
    const { writeRequestQueue } = await import('../write-request-queue');

    let installments = 1;
    let periodMonths = 12;
    if (policy.payment_frequency === 'monthly') { installments = 12; periodMonths = 1; }
    else if (policy.payment_frequency === 'quarterly') { installments = 4; periodMonths = 3; }
    else if (policy.payment_frequency === 'semi_annual') { installments = 2; periodMonths = 6; }

    const installmentAmount = Math.round(policy.annual_premium / installments);
    const startDate = new Date(policy.start_date);

    const categoryMap: Record<string, string> = {
      life_term: 'life_insurance',
      life_whole: 'life_insurance',
      accident: 'insurance',
      medical: 'insurance',
      car_insurance: 'insurance',
      pli: 'insurance',
      workers_comp: 'insurance',
    };

    const ledgerCategory = categoryMap[policy.category] ?? 'insurance';

    const submissions = [];
    for (let i = 0; i < installments; i++) {
      const idempotencyKey = `guardian_premium_${policy.policy_id}_${new Date().getFullYear()}_${i}`;
      const transactionDate = new Date(startDate);
      transactionDate.setMonth(transactionDate.getMonth() + (i * periodMonths));
      const formattedDate = transactionDate.toISOString().split('T')[0];

      submissions.push(writeRequestQueue.submit({
        source_agent:    'guardian',
        target_agent:    'accountant',
        collection:      'accountant_ledger',
        operation:       'create',
        idempotency_key: idempotencyKey,
        entity_type:     policy.entity_type,
        reason:          `安盾保費自動入帳 (${i+1}/${installments})：${CATEGORY_ZH[policy.category]}（${policy.insurer}）`,
        data: {
          type:             'expense',
          category:         ledgerCategory,
          description:      `保險費 (${i+1}/${installments})：${CATEGORY_ZH[policy.category]}（${policy.insurer}）— 被保人 ${policy.insured_name}`,
          amount_taxed:     installmentAmount,
          amount_untaxed:   installmentAmount,
          tax_amount:       0,
          tax_rate:         0,
          is_tax_exempt:    true,
          entity_type:      policy.entity_type,
          counterparty_name: policy.insurer,
          transaction_date: formattedDate,
          is_deductible:    true,
          notes:            `Guardian 自動入帳 | 保單 ${policy.policy_no_masked} | ${policy.payment_frequency} 第 ${i+1} 期`,
        },
      }));
    }

    const results = await Promise.all(submissions);
    const allOk = results.every(r => r.ok);

    logger.info(`[Guardian/collab/auto-booking] Premium booking sent: ${installments} requests, allOk: ${allOk}`);

    if (allOk) {
      await markLedgerLinked(policy.policy_id);
      logger.info(`[Guardian] Policy ${policy.policy_id} marked as ledger_linked`);
    }

    res.json({
      ok: allOk,
      installments_created: installments,
      request_ids: results.map(r => r.request_id),
      status: allOk ? 'success' : 'partial_failure',
      message: allOk
        ? `已向鳴鑫請求記入保費 NT$${policy.annual_premium.toLocaleString()}（分 ${installments} 期，每期約 NT$${installmentAmount.toLocaleString()}）`
        : '部分或全部入帳請求失敗',
      policy_id: policy.policy_id,
      booking_details: {
        category: CATEGORY_ZH[policy.category],
        insurer: policy.insurer,
        premium: policy.annual_premium,
        entity: ENTITY_ZH[policy.entity_type],
      },
    });
  } catch (err) {
    handleGuardianError(req, res, '保費入帳異常', err);
  }
});

