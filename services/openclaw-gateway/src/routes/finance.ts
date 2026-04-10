/**
 * Finance Agent Route — 融鑫財務顧問幕僚
 *
 * GET  /agents/finance/health                   — Agent 狀態
 * POST /agents/finance/chat                     — 自由問答（貸款/融資諮詢）
 * POST /agents/finance/calc/mortgage            — 房貸試算（含 LTV / DSR）
 * POST /agents/finance/calc/car                 — 車貸試算
 * POST /agents/finance/calc/loan                — 通用貸款試算（任何貸款）
 * POST /agents/finance/calc/compare             — 多方案貸款比較（最多4個）
 * GET  /agents/finance/calc/summary             — 三實體貸款彙整
 * POST /agents/finance/analyze                  — AI 資金壓力缺口分析（串接帳本）
 * POST /agents/finance/plan/company             — 工程公司融資規劃（AI）
 * POST /agents/finance/plan/personal            — 個人貸款規劃（AI）
 * POST /agents/finance/plan/family              — 家庭貸款規劃（AI）
 * POST /agents/finance/plan/consolidation       — 負債整合分析（AI）
 * POST /agents/finance/loan                     — 新增貸款記錄
 * GET  /agents/finance/loan                     — 查詢貸款列表
 * DELETE /agents/finance/loan/:id               — 刪除貸款記錄
 * GET  /agents/finance/report/cashflow          — 資金壓力報告
 * GET  /agents/finance/report/debt              — 負債總覽報告
 * POST /agents/finance/collab/accountant        — 向鳴鑫請求財務數據
 *
 * 設計原則：
 *   - 計算類（/calc/*）均確定性公式，無 LLM，即時回應
 *   - 分析/規劃類強制走本地 qwen3:14b（temperature=0.05）
 *   - 同安盾一樣全 PRIVATE，貸款資料不出境
 */

import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../logger';
import { ollamaChat } from '../ollama-inference.service';
import { financeSystemPrompt } from '../prompts';
import {
  addLoan, queryLoans, deleteLoan, calcLoanSummary,
  analyzeDebtConsolidation, calcAmortization, calcMortgage, calcCarLoan,
  compareLoanPlans, BANK_REFERENCE_RATES,
  LOAN_CATEGORY_ZH, ENTITY_ZH, REPAYMENT_ZH,
  type LoanRecord, type LoanCategory, type EntityType, type LoanStatus, type RepaymentMethod,
} from '../loan-store';

export const financeRouter = Router();

const AGENT_ID = 'finance';
const MODEL = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';
const ACCOUNTANT_URL = process.env['OPENCLAW_GATEWAY_URL'] ?? 'http://localhost:3100';


// ── 向鳴鑫取帳本數據 ───────────────────────────────────────────
async function fetchAccountantData(entity_type?: EntityType): Promise<{
  income: number; expense: number; net: number;
}> {
  try {
    const params = new URLSearchParams({ limit: '200' });
    if (entity_type) params.append('entity_type', entity_type);
    const resp = await fetch(
      `${ACCOUNTANT_URL}/agents/accountant/ledger?${params}`,
      { headers: { 'Authorization': 'Bearer dev-local-bypass' }, signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return { income: 0, expense: 0, net: 0 };
    const data = await resp.json() as { summary: { total_income: number; total_expense: number; net: number } };
    return {
      income: data.summary.total_income,
      expense: data.summary.total_expense,
      net: data.summary.net,
    };
  } catch {
    return { income: 0, expense: 0, net: 0 };
  }
}

// ============================================================
// ── GET /agents/finance/health ──────────────────────────────
// ============================================================
financeRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    agent_id: AGENT_ID,
    display_name: 'Flux 🐠 (Finance)',
    mascot: '🐟 金魚',
    status: 'ready',
    model: MODEL,
    inference_route: 'local',
    privacy_level: 'PRIVATE',
    capabilities: [
      'chat', 'analyze',
      'calc_mortgage', 'calc_car_loan', 'calc_loan', 'calc_compare', 'calc_summary',
      'plan_company', 'plan_personal', 'plan_family', 'plan_consolidation',
      'loan_crud', 'report_cashflow', 'report_debt',
      'collab_accountant',
    ],
    bank_rates_available: Object.keys(BANK_REFERENCE_RATES).length,
    collab_agents: ['accountant', 'guardian'],
  });
});

// ============================================================
// ── POST /agents/finance/chat ───────────────────────────────
// ============================================================
financeRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, context } = req.body as { message?: string; context?: string };
  if (!message?.trim()) { res.status(400).json({ error: 'message required' }); return; }
  const traceId = crypto.randomUUID();

  const userContent = `${message}${context ? `\n\n【背景資訊】${context}` : ''}`;
  try {
    const { content: reply, latency_ms } = await ollamaChat(
      [
        { role: 'system', content: financeSystemPrompt.template },
        { role: 'user', content: userContent },
      ],
      MODEL,
      { temperature: 0.05, num_predict: 2048 },
    );
    logger.info(`[Finance/chat] trace=${traceId} latency=${latency_ms}ms`);
    res.json({
      agent_id: AGENT_ID, model: MODEL, inference_route: 'local', privacy_level: 'PRIVATE',
      trace_id: traceId, latency_ms,
      reply: reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
    });
  } catch (err) {
    res.status(500).json({ error: '貸款諮詢 AI 異常', details: String(err) });
  }
});

// ============================================================
// ── POST /agents/finance/calc/mortgage ──────────────────────
// ── 房貸試算（含 LTV / DSR / 銀行比較）─────────────────────
// ============================================================
financeRouter.post('/calc/mortgage', async (req: Request, res: Response) => {
  const {
    property_value, loan_amount, annual_rate, loan_months = 360,
    monthly_income = 0, is_first_house = true,
    grace_period_months = 0, repayment_method = 'equal_payment',
  } = req.body as {
    property_value?: number; loan_amount?: number; annual_rate?: number;
    loan_months?: number; monthly_income?: number; is_first_house?: boolean;
    grace_period_months?: number; repayment_method?: RepaymentMethod;
  };

  if (!property_value || !loan_amount || !annual_rate) {
    res.status(400).json({
      error: 'property_value, loan_amount, annual_rate required',
      example: {
        property_value: 15000000, loan_amount: 10000000,
        annual_rate: 2.17, loan_months: 360, monthly_income: 80000,
        is_first_house: true, grace_period_months: 24,
        repayment_method: 'equal_payment',
      },
    });
    return;
  }

  const result = calcMortgage({
    property_value, loan_amount, annual_rate, loan_months,
    monthly_income, is_first_house, grace_period_months,
    repayment_method: repayment_method as RepaymentMethod,
  });

  logger.info(`[Finance/calc/mortgage] loan=${loan_amount} rate=${annual_rate}% months=${loan_months} dsr=${result.dsr_pct}%`);

  res.json({
    ok: true, calc_type: 'mortgage',
    ...result,
    repayment_method_zh: REPAYMENT_ZH[result.repayment_method],
    summary_message: (
      `房貸試算：月繳 NT$${result.monthly_payment_first.toLocaleString()}，` +
      `貸款成數 ${result.ltv_pct}%，` +
      `DSR ${result.dsr_pct}%（${result.is_dsr_ok ? '✅ 通過' : '❌ 超標'}）`
    ),
    legal_basis: '依台灣央行選擇性信用管制（2024年9月）及各銀行承作標準',
  });
});

// ── POST /agents/finance/calc/car ────────────────────────────
financeRouter.post('/calc/car', async (req: Request, res: Response) => {
  const { vehicle_price, down_payment, annual_rate, loan_months = 60 } = req.body as {
    vehicle_price?: number; down_payment?: number; annual_rate?: number; loan_months?: number;
  };

  if (!vehicle_price || !annual_rate) {
    res.status(400).json({
      error: 'vehicle_price, annual_rate required',
      example: { vehicle_price: 1200000, down_payment: 240000, annual_rate: 3.5, loan_months: 60 },
    });
    return;
  }

  const dp = down_payment ?? Math.round(vehicle_price * 0.2);
  const result = calcCarLoan({ vehicle_price, down_payment: dp, annual_rate, loan_months });

  res.json({
    ok: true, calc_type: 'car_loan', ...result,
    summary_message: `車貸試算：頭期款 NT$${dp.toLocaleString()}（${result.down_payment_pct}%），月繳 NT$${result.monthly_payment_first.toLocaleString()}，${loan_months}個月`,
  });
});

// ── POST /agents/finance/calc/loan — 通用貸款試算 ───────────
financeRouter.post('/calc/loan', async (req: Request, res: Response) => {
  const {
    principal, annual_rate, loan_months,
    repayment_method = 'equal_payment', grace_period_months = 0,
    loan_name,
  } = req.body as {
    principal?: number; annual_rate?: number; loan_months?: number;
    repayment_method?: RepaymentMethod; grace_period_months?: number;
    loan_name?: string;
  };

  if (!principal || !annual_rate || !loan_months) {
    res.status(400).json({
      error: 'principal, annual_rate, loan_months required',
      example: { principal: 5000000, annual_rate: 3.5, loan_months: 36, repayment_method: 'equal_payment' },
      repayment_methods: ['equal_payment', 'equal_principal', 'interest_only', 'balloon'],
    });
    return;
  }

  const result = calcAmortization({
    principal, annual_rate, loan_months,
    repayment_method: repayment_method as RepaymentMethod,
    grace_period_months,
  });

  res.json({
    ok: true, calc_type: 'general_loan', loan_name,
    repayment_method_zh: REPAYMENT_ZH[repayment_method as RepaymentMethod],
    ...result,
    summary_message: `月繳 NT$${result.monthly_payment_first.toLocaleString()}，總利息 NT$${result.total_interest.toLocaleString()}（佔 ${result.interest_ratio_pct}%）`,
  });
});

// ── POST /agents/finance/calc/compare — 多方案比較 ──────────
financeRouter.post('/calc/compare', async (req: Request, res: Response) => {
  const { plans } = req.body as {
    plans?: Array<{
      label: string; principal: number; annual_rate: number;
      loan_months: number; repayment_method?: RepaymentMethod;
    }>;
  };

  if (!plans || plans.length < 2) {
    res.status(400).json({
      error: 'At least 2 plans required',
      example: {
        plans: [
          { label: '方案A（土地銀行）', principal: 10000000, annual_rate: 2.15, loan_months: 360, repayment_method: 'equal_payment' },
          { label: '方案B（玉山銀行）', principal: 10000000, annual_rate: 2.22, loan_months: 300, repayment_method: 'equal_payment' },
          { label: '方案C（等額本金）', principal: 10000000, annual_rate: 2.17, loan_months: 360, repayment_method: 'equal_principal' },
        ],
      },
    });
    return;
  }

  const result = compareLoanPlans(plans as Array<{
    label: string; principal: number; annual_rate: number;
    loan_months: number; repayment_method?: RepaymentMethod;
  }>);

  res.json({ ok: true, calc_type: 'loan_comparison', ...result });
});

// ── GET /agents/finance/calc/summary — 貸款彙整 ─────────────
financeRouter.get('/calc/summary', async (_req: Request, res: Response) => {
  const summary = await calcLoanSummary();
  res.json({ ok: true, ...summary });
});

// ============================================================
// ── POST /agents/finance/analyze — AI 資金壓力分析 ──────────
// ============================================================
financeRouter.post('/analyze', async (req: Request, res: Response) => {
  const { year } = req.body as { year?: number };
  const targetYear = year ?? new Date().getFullYear();
  const traceId = crypto.randomUUID();

  const [coData, peData, faData, activeLoans, loanSummary] = await Promise.all([
    fetchAccountantData('co_construction'),
    fetchAccountantData('personal'),
    fetchAccountantData('family'),
    queryLoans({ status: 'active', limit: 200 }),
    calcLoanSummary(),
  ]);

  const totalMonthly = loanSummary.grand_total_monthly;
  const totalOutstanding = loanSummary.grand_total_outstanding;

  // DSR 評估（個人）
  const personalMonthlyIncome = peData.income / 12;
  const personalLoanMonthly = loanSummary.by_entity.find(e => e.entity_type === 'personal')?.total_monthly_payment ?? 0;
  const personalDsr = personalMonthlyIncome > 0
    ? Math.round(personalLoanMonthly / personalMonthlyIncome * 1000) / 10
    : 0;

  // 公司償債能力
  const companyLoanMonthly = loanSummary.by_entity.find(e => e.entity_type === 'co_construction')?.total_monthly_payment ?? 0;
  const companyMonthlyRevenue = coData.income / 12;
  const companyDsr = companyMonthlyRevenue > 0
    ? Math.round(companyLoanMonthly / companyMonthlyRevenue * 1000) / 10
    : 0;

  const loanList = activeLoans.slice(0, 15).map(l =>
    `${LOAN_CATEGORY_ZH[l.category]} | ${l.bank} | 餘額NT$${l.outstanding_balance.toLocaleString()} | 年利率${l.annual_rate}% | 月繳NT$${l.monthly_payment.toLocaleString()}`
  ).join('\n') || '（尚未登錄任何貸款）';

  const prompt = `${financeSystemPrompt.template}

---
【年度財務背景（${targetYear}年）】
🏢 公司：年收入 NT$${coData.income.toLocaleString()} | 月均 NT$${Math.round(companyMonthlyRevenue).toLocaleString()} | 年淨利 NT$${coData.net.toLocaleString()}
👤 個人：年薪 NT$${peData.income.toLocaleString()} | 月均 NT$${Math.round(personalMonthlyIncome).toLocaleString()}
🏠 家庭：年支出 NT$${faData.expense.toLocaleString()}

【已登錄貸款（共 ${activeLoans.length} 筆）】
${loanList}

【整體負債概況】
月繳合計: NT$${totalMonthly.toLocaleString()}
未還本金: NT$${totalOutstanding.toLocaleString()}

【債務比率評估】
個人 DSR: ${personalDsr}%（建議 ≤33%）${personalDsr > 33 ? ' ⚠️ 超標' : ' ✅ 正常'}
公司債務佔收入比: ${companyDsr}%${companyDsr > 30 ? ' ⚠️ 偏高' : ' ✅ 正常'}

---
請輸出完整的三實體資金壓力分析：

1.【公司融資健診】周轉能力、負債比率、應改善項目
2.【個人貸款健診】DSR分析、現有貸款利率優化空間
3.【家庭負債健診】房貸+車貸壓力、再融資機會
4.【優先行動清單】依緊迫性排序 5 項具體建議（含預期效益）
5.⚠️ 風險聲明

繁體中文，數字精確，引用台灣法規/政策。`;

  try {
    const { content, latency_ms } = await ollamaChat(
      [{ role: 'user', content: prompt }],
      MODEL,
      { temperature: 0.05, num_predict: 3000 },
    );

    res.json({
      ok: true, year: targetYear, trace_id: traceId,
      latency_ms, privacy_level: 'PRIVATE', model: MODEL,
      data_summary: {
        company: { ...coData, loan_monthly: companyLoanMonthly, dsr_pct: companyDsr },
        personal: { ...peData, loan_monthly: personalLoanMonthly, dsr_pct: personalDsr },
        family: faData,
        active_loans: activeLoans.length,
        total_monthly: totalMonthly,
        total_outstanding: totalOutstanding,
      },
      analysis: content.replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
      disclaimer: '以上分析依帳本資料自動生成，實際貸款申請需諮詢銀行或金融機構，不構成財務建議。',
    });
  } catch (err) {
    res.status(500).json({ error: '資金分析 AI 異常', details: String(err) });
  }
});

// ============================================================
// ── POST /agents/finance/plan/* — AI 融資規劃 ───────────────
// ============================================================

async function generateFinancePlan(
  entity: EntityType | 'consolidation',
  context: Record<string, unknown>,
) {
  const entityName = entity === 'co_construction' ? '工程公司' : entity === 'personal' ? '個人' : entity === 'family' ? '家庭' : entity === 'co_drone' ? '無人機' : entity === 'co_renovation' ? '裝修' : entity === 'co_design' ? '設計' : entity === 'assoc_rescue' ? '救難協會' : '負債整合';
  const prompt = `${financeSystemPrompt.template}

---
【規劃對象】${entityName}
【財務與負債背景】${JSON.stringify(context, null, 2)}

請為【${entityName}】輸出完整融資規劃：

**現況評估**（負債結構、還款壓力、Cash Flow分析）
**建議融資方案**（每個方案：目的、金額、建議利率區間、還款方式、申辦管道）
**風險評估**（過槓、利率風險、流動性風險）
**行動清單**（3-5項具體步驟，含時程和預期達成指標）
⚠️ 風險提示

繁體中文，數字精確。`;

  const { content, latency_ms } = await ollamaChat(
    [{ role: 'user', content: prompt }],
    MODEL,
    { temperature: 0.05, num_predict: 3000 },
  );
  return { plan: content.replace(/<think>[\s\S]*?<\/think>/g, '').trim(), latency_ms };
}

financeRouter.post('/plan/company', async (req: Request, res: Response) => {
  const traceId = crypto.randomUUID();
  const [coData, loans] = await Promise.all([
    fetchAccountantData('co_construction'),
    queryLoans({ entity_type: 'co_construction', status: 'active', limit: 50 }),
  ]);
  const context = {
    annual_revenue: coData.income, annual_expense: coData.expense, net_profit: coData.net,
    active_loans: loans.length,
    total_outstanding: loans.reduce((s, l) => s + l.outstanding_balance, 0),
    total_monthly_payment: loans.reduce((s, l) => s + l.monthly_payment, 0),
    loan_list: loans.map(l => `${LOAN_CATEGORY_ZH[l.category]} ${l.bank} 年利率${l.annual_rate}%`),
  };
  try {
    const { plan, latency_ms } = await generateFinancePlan('co_construction', context);
    res.json({ ok: true, entity: 'co_construction', trace_id: traceId, latency_ms, privacy_level: 'PRIVATE', plan,
      disclaimer: '規劃建議依帳本資料自動生成，不構成財務建議。' });
  } catch (err) {
    res.status(500).json({ error: '規劃 AI 異常', details: String(err) });
  }
});

financeRouter.post('/plan/personal', async (req: Request, res: Response) => {
  const { monthly_income } = req.body as { monthly_income?: number };
  const traceId = crypto.randomUUID();
  const [peData, loans] = await Promise.all([
    fetchAccountantData('personal'),
    queryLoans({ entity_type: 'personal', status: 'active', limit: 50 }),
  ]);
  const income = monthly_income ?? Math.round(peData.income / 12);
  const totalMonthlyPayment = loans.reduce((s, l) => s + l.monthly_payment, 0);
  const dsr = income > 0 ? Math.round(totalMonthlyPayment / income * 1000) / 10 : 0;
  const context = {
    monthly_income: income, annual_income: peData.income,
    active_loans: loans.length,
    total_outstanding: loans.reduce((s, l) => s + l.outstanding_balance, 0),
    total_monthly_payment: totalMonthlyPayment,
    dsr_pct: dsr,
    loan_list: loans.map(l => `${LOAN_CATEGORY_ZH[l.category]} ${l.bank} 年利率${l.annual_rate}%`),
  };
  try {
    const { plan, latency_ms } = await generateFinancePlan('personal', context);
    res.json({ ok: true, entity: 'personal', trace_id: traceId, latency_ms, privacy_level: 'PRIVATE',
      plan, dsr_pct: dsr, disclaimer: '規劃建議自動生成，不構成財務建議。' });
  } catch (err) {
    res.status(500).json({ error: '規劃 AI 異常', details: String(err) });
  }
});

financeRouter.post('/plan/family', async (req: Request, res: Response) => {
  const traceId = crypto.randomUUID();
  const [faData, loans] = await Promise.all([
    fetchAccountantData('family'),
    queryLoans({ entity_type: 'family', status: 'active', limit: 50 }),
  ]);
  const context = {
    annual_family_expense: faData.expense,
    active_loans: loans.length,
    total_outstanding: loans.reduce((s, l) => s + l.outstanding_balance, 0),
    total_monthly_payment: loans.reduce((s, l) => s + l.monthly_payment, 0),
    loan_list: loans.map(l => `${LOAN_CATEGORY_ZH[l.category]} ${l.bank} 年利率${l.annual_rate}% 月繳NT$${l.monthly_payment.toLocaleString()}`),
  };
  try {
    const { plan, latency_ms } = await generateFinancePlan('family', context);
    res.json({ ok: true, entity: 'family', trace_id: traceId, latency_ms, privacy_level: 'PRIVATE', plan,
      disclaimer: '規劃建議自動生成，不構成財務建議。' });
  } catch (err) {
    res.status(500).json({ error: '規劃 AI 異常', details: String(err) });
  }
});

financeRouter.post('/plan/consolidation', async (req: Request, res: Response) => {
  const { consolidation_rate = 3.0, consolidation_months = 120 } = req.body as {
    consolidation_rate?: number; consolidation_months?: number;
  };
  const traceId = crypto.randomUUID();
  try {
    const debtAnalysis = await analyzeDebtConsolidation(consolidation_rate, consolidation_months);
    const context = {
      current_total_monthly: debtAnalysis.current_total_monthly,
      current_total_outstanding: debtAnalysis.current_total_outstanding,
      current_total_interest_remaining: debtAnalysis.current_total_interest_remaining,
      consolidation_rate, consolidation_months,
      consolidated_monthly: debtAnalysis.consolidated_monthly,
      monthly_saving: debtAnalysis.monthly_saving,
      interest_saving: debtAnalysis.interest_saving,
      is_beneficial: debtAnalysis.is_beneficial,
      loans_count: debtAnalysis.current_loans.length,
      loan_list: debtAnalysis.current_loans.map(l =>
        `${LOAN_CATEGORY_ZH[l.category]} ${l.bank} 年利率${l.annual_rate}% 餘額NT$${l.outstanding_balance.toLocaleString()}`
      ),
    };
    const { plan, latency_ms } = await generateFinancePlan('consolidation', context);
    res.json({
      ok: true, entity: 'consolidation', trace_id: traceId, latency_ms, privacy_level: 'PRIVATE',
      debt_analysis: debtAnalysis, plan,
      disclaimer: '試算結果供參考，實際整合貸款需與銀行洽談，不構成財務建議。',
    });
  } catch (err) {
    res.status(500).json({ error: '整合分析 AI 異常', details: String(err) });
  }
});

// ============================================================
// ── 貸款 CRUD ────────────────────────────────────────────────
// ── POST /agents/finance/loan — 新增貸款 ────────────────────
// ============================================================
financeRouter.post('/loan', async (req: Request, res: Response) => {
  const {
    entity_type, category, bank, loan_name,
    principal, outstanding_balance, annual_rate, loan_months, remaining_months,
    monthly_payment, repayment_method = 'equal_payment',
    start_date, end_date, status = 'active',
    collateral, grace_period_months, notes,
  } = req.body as Partial<LoanRecord>;

  if (!entity_type || !category || !bank || !principal || !annual_rate || !loan_months || !start_date) {
    res.status(400).json({
      error: 'entity_type, category, bank, principal, annual_rate, loan_months, start_date required',
      categories: Object.keys(LOAN_CATEGORY_ZH),
      entity_types: ['personal','family','co_drone','co_construction','co_renovation','co_design','assoc_rescue'],
      repayment_methods: ['equal_payment', 'equal_principal', 'interest_only', 'balloon'],
    });
    return;
  }

  // 自動計算月繳（若未提供）
  const auto_monthly = monthly_payment ?? calcAmortization({
    principal, annual_rate, loan_months,
    repayment_method: repayment_method as RepaymentMethod,
  }).monthly_payment_first;

  // 計算結束日期（若未提供）
  const auto_end_date = end_date ?? (() => {
    const d = new Date(start_date);
    d.setMonth(d.getMonth() + loan_months);
    return d.toISOString().split('T')[0];
  })();

  const loan: LoanRecord = {
    loan_id: crypto.randomUUID(),
    entity_type, category, bank, loan_name,
    principal,
    outstanding_balance: outstanding_balance ?? principal,
    annual_rate,
    loan_months,
    remaining_months: remaining_months ?? loan_months,
    monthly_payment: auto_monthly,
    repayment_method: repayment_method as RepaymentMethod,
    start_date,
    end_date: auto_end_date!,
    status: status as LoanStatus,
    collateral, grace_period_months, notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ledger_linked: false,
  };

  await addLoan(loan);
  logger.info(`[Finance/loan] Added ${category} ${bank} entity=${entity_type} principal=${principal}`);

  res.status(201).json({
    ok: true, loan_id: loan.loan_id,
    summary: {
      category_zh: LOAN_CATEGORY_ZH[category],
      entity_label: ENTITY_ZH[entity_type],
      bank, principal, annual_rate, loan_months,
      monthly_payment: auto_monthly,
      start_date, end_date: auto_end_date,
      status: 'active',
    },
    message: `貸款已登錄：${ENTITY_ZH[entity_type]} - ${LOAN_CATEGORY_ZH[category]}（${bank}）`,
    ledger_tip: `💡 可同步至帳本：/acc ledger add expense loan_interest ${auto_monthly} ${bank}月繳 ${entity_type}`,
  });
});

// ── GET /agents/finance/loan — 查詢貸款 ─────────────────────
financeRouter.get('/loan', async (req: Request, res: Response) => {
  const { entity_type, category, status, limit } = req.query as Record<string, string | undefined>;

  const loans = await queryLoans({
    entity_type: entity_type as EntityType,
    category: category as LoanCategory,
    status: (status ?? 'active') as LoanStatus,
    limit: limit ? parseInt(limit) : 100,
  });

  const totalOutstanding = loans.reduce((s, l) => s + l.outstanding_balance, 0);
  const totalMonthly = loans.reduce((s, l) => s + l.monthly_payment, 0);

  res.json({
    count: loans.length,
    summary: {
      total_outstanding: totalOutstanding,
      total_monthly_payment: totalMonthly,
      by_entity: (['personal', 'family', 'co_drone', 'co_construction', 'co_renovation', 'co_design', 'assoc_rescue'] as EntityType[]).map(et => ({
        entity_type: et, entity_label: ENTITY_ZH[et],
        count: loans.filter(l => l.entity_type === et).length,
        outstanding: loans.filter(l => l.entity_type === et).reduce((s, l) => s + l.outstanding_balance, 0),
        monthly: loans.filter(l => l.entity_type === et).reduce((s, l) => s + l.monthly_payment, 0),
      })),
    },
    loans: loans.map(l => ({
      ...l,
      category_zh: LOAN_CATEGORY_ZH[l.category],
      entity_label: ENTITY_ZH[l.entity_type],
      repayment_method_zh: REPAYMENT_ZH[l.repayment_method],
    })),
  });
});

// ── DELETE /agents/finance/loan/:id ─────────────────────────
financeRouter.delete('/loan/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const existed = await deleteLoan(id);
  if (!existed) { res.status(404).json({ error: 'Loan not found' }); return; }
  logger.info(`[Finance/loan] Deleted ${id}`);
  res.json({ ok: true, loan_id: id, message: '貸款記錄已刪除' });
});

// ============================================================
// ── GET /agents/finance/report/cashflow — 資金壓力報告 ──────
// ============================================================
financeRouter.get('/report/cashflow', async (_req: Request, res: Response) => {
  const [loanSummary, coData, peData, faData] = await Promise.all([
    calcLoanSummary(),
    fetchAccountantData('co_construction'),
    fetchAccountantData('personal'),
    fetchAccountantData('family'),
  ]);

  const personalMonthlyIncome = peData.income / 12;
  const personalLoanMonth = loanSummary.by_entity.find(e => e.entity_type === 'personal')?.total_monthly_payment ?? 0;
  const dsr = personalMonthlyIncome > 0 ? Math.round(personalLoanMonth / personalMonthlyIncome * 1000) / 10 : 0;

  const companyMonthlyRevenue = coData.income / 12;
  const companyLoanMonth = loanSummary.by_entity.find(e => e.entity_type === 'co_construction')?.total_monthly_payment ?? 0;
  const companyLoanRatio = companyMonthlyRevenue > 0 ? Math.round(companyLoanMonth / companyMonthlyRevenue * 1000) / 10 : 0;

  const alerts: Array<{ level: string; message: string }> = [];
  if (dsr > 33) alerts.push({ level: 'CRITICAL', message: `個人 DSR ${dsr}% 超過 33%，恐影響貸款申請` });
  if (dsr > 25 && dsr <= 33) alerts.push({ level: 'WARNING', message: `個人 DSR ${dsr}%，接近上限，避免增加貸款` });
  if (companyLoanRatio > 30) alerts.push({ level: 'WARNING', message: `公司貸款佔月收入 ${companyLoanRatio}%，注意資金周轉` });
  if (loanSummary.grand_total_outstanding > 20_000_000) {
    alerts.push({ level: 'INFO', message: `總負債超過 NT$2,000 萬，建議定期評估負債整合方案` });
  }

  res.json({
    ok: true,
    generated_at: new Date().toISOString(),
    overall_alert: alerts.find(a => a.level === 'CRITICAL') ? 'CRITICAL' : alerts.find(a => a.level === 'WARNING') ? 'WARNING' : 'OK',
    debt_summary: {
      total_outstanding: loanSummary.grand_total_outstanding,
      total_monthly_payment: loanSummary.grand_total_monthly,
      by_entity: loanSummary.by_entity.map(e => ({
        entity_label: e.entity_label,
        count: e.active_count,
        outstanding: e.total_outstanding,
        monthly: e.total_monthly_payment,
      })),
    },
    dsr_analysis: {
      personal_monthly_income: Math.round(personalMonthlyIncome),
      personal_loan_monthly: personalLoanMonth,
      dsr_pct: dsr,
      dsr_status: dsr > 33 ? 'CRITICAL' : dsr > 25 ? 'WARNING' : 'OK',
      dsr_label: dsr > 33 ? `🚨 DSR ${dsr}% 超標` : dsr > 25 ? `⚠️ DSR ${dsr}% 接近上限` : `✅ DSR ${dsr}% 正常`,
    },
    company_analysis: {
      monthly_revenue: Math.round(companyMonthlyRevenue),
      loan_monthly: companyLoanMonth,
      loan_revenue_ratio_pct: companyLoanRatio,
      status: companyLoanRatio > 30 ? 'WARNING' : 'OK',
    },
    alerts,
  });
});

// ── GET /agents/finance/report/debt — 負債總覽 ───────────────
financeRouter.get('/report/debt', async (_req: Request, res: Response) => {
  const loans = await queryLoans({ status: 'active', limit: 200 });
  const totalOutstanding = loans.reduce((s, l) => s + l.outstanding_balance, 0);
  const totalMonthly = loans.reduce((s, l) => s + l.monthly_payment, 0);

  // 按利率排序（利率最高者優先還清）
  const highRateLoan = [...loans].sort((a, b) => b.annual_rate - a.annual_rate).slice(0, 3);

  // 估算加權平均利率
  const weightedRate = totalOutstanding > 0
    ? loans.reduce((s, l) => s + l.annual_rate * l.outstanding_balance, 0) / totalOutstanding
    : 0;

  res.json({
    ok: true,
    generated_at: new Date().toISOString(),
    total_outstanding: totalOutstanding,
    total_monthly_payment: totalMonthly,
    active_loans_count: loans.length,
    weighted_avg_rate: Math.round(weightedRate * 100) / 100,
    by_entity: (['personal', 'family', 'co_drone', 'co_construction', 'co_renovation', 'co_design', 'assoc_rescue'] as EntityType[]).map(et => {
      const ls = loans.filter(l => l.entity_type === et);
      return {
        entity_label: ENTITY_ZH[et],
        count: ls.length,
        outstanding: ls.reduce((s, l) => s + l.outstanding_balance, 0),
        monthly: ls.reduce((s, l) => s + l.monthly_payment, 0),
        avg_rate: ls.length > 0 ? Math.round(ls.reduce((s, l) => s + l.annual_rate, 0) / ls.length * 100) / 100 : 0,
      };
    }),
    high_rate_loans: highRateLoan.map(l => ({
      category_zh: LOAN_CATEGORY_ZH[l.category],
      bank: l.bank,
      annual_rate: l.annual_rate,
      outstanding: l.outstanding_balance,
      suggestion: l.annual_rate > 5 ? '⚠️ 利率偏高，考慮轉貸或提前還清' : '✅ 利率合理',
    })),
    payoff_priority: highRateLoan.length > 0
      ? `建議優先還清：${highRateLoan[0]?.bank} ${LOAN_CATEGORY_ZH[highRateLoan[0]?.category as LoanCategory] ?? ''}（年利率 ${highRateLoan[0]?.annual_rate}%）`
      : '（無貸款记录）',
  });
});

// ── POST /agents/finance/collab/accountant ───────────────────
financeRouter.post('/collab/accountant', async (req: Request, res: Response) => {
  const { entity_type, purpose } = req.body as { entity_type?: EntityType; purpose?: string };
  const data = await fetchAccountantData(entity_type);
  logger.info(`[Finance/collab] Fetched ${entity_type ?? 'all'} from Accountant for: ${purpose}`);
  res.json({ ok: true, source: 'accountant', entity_type, purpose, data });
});
