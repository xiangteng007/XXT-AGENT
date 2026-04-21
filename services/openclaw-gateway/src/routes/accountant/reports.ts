/**
 * Accountant — Reports Sub-router (A-3 / CR-02)
 *
 * GET  /agents/accountant/report/entity  — 各實體收支比較
 * POST /agents/accountant/taxplan        — AI 節稅規劃
 *
 * 拆分自 routes/accountant.ts（原 L795-L914）
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../logger';
import { ollamaChat } from '../../ollama-inference.service';
import { queryEntries, type LedgerEntry, type EntityType } from '../../ledger-store';
import { entityLabel } from '../../bank-store';
import { taxplanSystemPrompt } from '../../prompts';
import { queryRag, REGULATION_RAG_URL, MODEL } from './shared';

export const reportsRouter = Router();

// ── GET /report/entity ── 各實體收支比較 ─────────────────────
reportsRouter.get('/report/entity', async (req: Request, res: Response) => {
  const { entity, period, year } = req.query as Record<string, string | undefined>;
  const validEntities: EntityType[] = ['personal', 'family', 'co_drone', 'co_construction', 'co_renovation', 'co_design', 'assoc_rescue'];
  const targetYear = year ? parseInt(year) : new Date().getFullYear();
  const entitiesToQuery: EntityType[] = validEntities.includes(entity as EntityType) ? [entity as EntityType] : validEntities;

  const results = await Promise.all(entitiesToQuery.map(async (ent) => {
    const entries = await queryEntries({ entity_type: ent, period, year: period ? undefined : targetYear });
    const income  = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount_taxed, 0);
    const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount_taxed, 0);
    const taxOutput = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.tax_amount, 0);
    const taxInput  = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.tax_amount, 0);
    const byCategory: Record<string, number> = {};
    entries.forEach(e => { byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_taxed; });
    const deductCats = ['medical', 'education', 'life_insurance', 'house_rent'];
    const deductible_items = ent === 'family' ? deductCats.map(cat => ({ category: cat, amount: byCategory[cat] ?? 0 })).filter(d => d.amount > 0) : undefined;
    return {
      entity_type: ent, entity_label: entityLabel(ent), period: period ?? `${targetYear}年`,
      entry_count: entries.length, total_income: income, total_expense: expense,
      net_profit_loss: income - expense, tax_output: taxOutput, tax_input: taxInput, net_tax: taxOutput - taxInput,
      top_categories: Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5),
      ...(deductible_items ? { deductible_items } : {}),
    };
  }));
  res.json({ generated_at: new Date().toISOString(), query: { entity: entity ?? 'all', period, year: targetYear }, entities: results });
});

// ── POST /taxplan ── AI 節稅規劃 ─────────────────────────────
reportsRouter.post('/taxplan', async (req: Request, res: Response) => {
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
  const deductions = Object.entries(deductionLimits).map(([cat, limit]) => ({ category: cat, actual: fS.byCategory[cat] ?? 0, limit, claimable: Math.min(fS.byCategory[cat] ?? 0, limit) }));
  const totalDeductible = deductions.reduce((s, d) => s + d.claimable, 0);

  if (mode === 'deduct') {
    res.json({ mode: 'deduct', year: targetYear, deductions, total_deductible: totalDeductible, note: '以上為依帳本資料估算，實際申報以收據/單據為準' });
    return;
  }

  // AI 節稅建議（RAG 增強）
  let ragContext = '（法規資料庫未連線，以通用知識回答）';
  try {
    const baseTopics = ['個人綜合所得稅扣除額種類與上限', '工程公司費用合理列支節稅方法'];
    const dynamicTopics: string[] = [];
    
    // 依據公司最高支出動態加入查詢
    const topCompanyExpenses = Object.entries(cS.byCategory).sort((a,b)=>b[1]-a[1]).slice(0, 2);
    topCompanyExpenses.forEach(([cat]) => dynamicTopics.push(`公司 ${cat} 費用 節稅 列報規定`));

    // 依據家庭高額扣除項目動態加入查詢
    const highDeductions = deductions.filter(d => d.actual > 0).sort((a,b)=>b.actual-a.actual).slice(0, 2).map(d => d.category);
    const catMap: Record<string, string> = { medical: '醫藥生育費', education: '教育學費', life_insurance: '保險費', house_rent: '房屋租金支出' };
    highDeductions.forEach(cat => {
      if (catMap[cat]) dynamicTopics.push(`${catMap[cat]} 列舉扣除額 申報規定`);
    });

    const topics = Array.from(new Set([...baseTopics, ...dynamicTopics])).slice(0, 5);
    const ragResults = await Promise.allSettled(topics.map(t =>
      fetch(`${REGULATION_RAG_URL}/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: t, category: 'tax', top_k: 2 }) }).then(r => r.ok ? r.json() : null)));
    const snippets = ragResults
      .filter(r => r.status === 'fulfilled' && r.value)
      .map((r, i) => {
        const v = (r as PromiseFulfilledResult<{ results?: Array<{ content: string }> }>).value;
        return `【${topics[i]}】\n${v?.results?.[0]?.content ?? '查無資料'}`;
      });
    if (snippets.length > 0) ragContext = snippets.join('\n\n');
  } catch { /* noop */ }

  const prompt = `你是鳴鑫會計師，擁有15年台灣工程公司會計經驗。請根據以下帳本資料和稅法條文，提供「${targetYear}年度」個人化節稅規劃建議。

### 📊 ${targetYear}年度帳本資料
**【公司帳】**
* 收入：NT$${cS.income.toLocaleString()}
* 支出：NT$${cS.expense.toLocaleString()}
* 損益：NT$${cS.net.toLocaleString()}
* 主要支出項目：${Object.entries(cS.byCategory).filter(([,v])=>v>0).map(([k,v])=>`${k} (NT$${v.toLocaleString()})`).join(', ')}

**【個人帳】**
* 所得：NT$${pS.income.toLocaleString()}
* 支出：NT$${pS.expense.toLocaleString()}

**【家庭可申報扣除額】**
${deductions.filter(d=>d.actual>0).map(d=>`* ${d.category}：實際 NT$${d.actual.toLocaleString()}，可申報 NT$${d.claimable.toLocaleString()} (上限 NT$${d.limit.toLocaleString()})`).join('\n')}
* **合計可申報：NT$${totalDeductible.toLocaleString()}**

### 📜 相關稅法參考
${ragContext}

### 📝 輸出要求
請以專業 Markdown 格式分三大區塊輸出：
1. **【🏢 公司面節稅規劃】**：分析節稅機會與風險提醒（請具體引用上方稅法條文）
2. **【🧑 個人及家庭節稅規劃】**：針對薪資扣除與綜所稅提供具體建議
3. **【📋 建議行動清單】**：提供 3-5 項具體可行的步驟，並附上預估可省下的稅金金額

請使用繁體中文，語氣嚴謹且親切。在報告最後，請務必加上 ⚠️ **風險提醒** 區塊。`;

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
      data_summary: { company: { income: cS.income, expense: cS.expense, net: cS.net }, personal: { income: pS.income, expense: pS.expense }, family: { deductible_total: totalDeductible, deductions } },
      plan: finalPlanA,
      disclaimer: '以上建議依帳本資料自動生成，申報前請與稅務機關確認，不構成法律意見。',
    });
  } catch (err) {
    logger.error(`[Taxplan] AI failed: ${String(err)}`);
    res.status(500).json({ error: '節稅規劃 AI 異常', details: String(err) });
  }
});
