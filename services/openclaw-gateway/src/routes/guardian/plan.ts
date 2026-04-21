import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { ollamaChat } from '../../ollama-inference.service';
import { guardianSystemPrompt } from '../../prompts';
import { queryPolicies, calcLifeInsurance, CATEGORY_ZH, type EntityType } from '../../insurance-store';
import { MODEL, fetchAccountantData, queryInsuranceRag } from './shared';

export const planRouter = Router();

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

planRouter.post('/company', async (req: Request, res: Response) => {
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

planRouter.post('/personal', async (req: Request, res: Response) => {
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

planRouter.post('/family', async (req: Request, res: Response) => {
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

planRouter.post('/full', async (req: Request, res: Response) => {
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
