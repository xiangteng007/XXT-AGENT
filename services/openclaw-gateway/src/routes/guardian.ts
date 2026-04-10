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

// ============================================================
// ── GET /agents/guardian/health ─────────────────────────────
// ============================================================
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
    res.status(500).json({ error: '保險諮詢 AI 異常', details: String(err) });
  }
});

// ============================================================
// ── POST /agents/guardian/calc/car ──────────────────────────
// ── 工程保險費率試算（確定性計算，無 LLM）───────────────────
// ============================================================
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
guardianRouter.get('/calc/premium', async (_req: Request, res: Response) => {
  const summary = await calcPremiumSummary();
  res.json({ ok: true, ...summary });
});

// ============================================================
// ── POST /agents/guardian/analyze ───────────────────────────
// ── 三實體保障缺口分析（AI + 帳本整合）─────────────────────
// ============================================================
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
    res.status(500).json({ error: '缺口分析 AI 異常', details: String(err) });
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
    res.status(500).json({ error: '規劃 AI 異常', details: String(err) });
  }
});

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
    res.status(500).json({ error: '規劃 AI 異常', details: String(err) });
  }
});

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
    res.status(500).json({ error: '規劃 AI 異常', details: String(err) });
  }
});

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
    res.status(500).json({ error: '統合規劃 AI 異常', details: String(err) });
  }
});

// ============================================================
// ── 保單 CRUD ────────────────────────────────────────────────
// ── POST /agents/guardian/policy — 新增保單 ─────────────────
// ============================================================
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

  res.json({
    ok: true,
    generated_at: new Date().toISOString(),
    overall_score: Math.round((coveredCount / gapItems.length) * 100),
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
guardianRouter.get('/report/premium', async (_req: Request, res: Response) => {
  const [premiumSummary, activePolicies] = await Promise.all([
    calcPremiumSummary(),
    queryPolicies({ status: 'active', limit: 200 }),
  ]);

  // 嘗試從帳本取 life_insurance 支出
  let ledgerLifePremium = 0;
  try {
    const resp = await fetch(
      `${ACCOUNTANT_URL}/agents/accountant/ledger?category=life_insurance&limit=50`,
      { headers: { 'Authorization': 'Bearer dev-local-bypass' }, signal: AbortSignal.timeout(5000) },
    );
    if (resp.ok) {
      const data = await resp.json() as { summary: { total_expense: number } };
      ledgerLifePremium = data.summary?.total_expense ?? 0;
    }
  } catch { /* ignore */ }

  const registeredPremium = premiumSummary.grand_total;
  const delta = Math.abs(ledgerLifePremium - registeredPremium);

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
    ledger_life_insurance: {
      annual_expense: ledgerLifePremium,
      note: '帳本 life_insurance 科目年度支出',
    },
    reconciliation: {
      delta,
      status: delta < 5000 ? 'MATCHED' : 'DISCREPANCY',
      label: delta < 5000
        ? '✅ 帳本與保單記錄相符'
        : `⚠️ 差異 NT$${delta.toLocaleString()}（可能有未登錄保單）`,
      action: delta > 5000 ? '建議使用 /ins policy add 補錄未登錄保單' : null,
    },
  });
});

// ── POST /agents/guardian/collab/accountant — Agent 協作 ────
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
