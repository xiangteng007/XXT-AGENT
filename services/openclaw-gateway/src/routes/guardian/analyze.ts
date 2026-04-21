import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../../logger';
import { ollamaChat } from '../../ollama-inference.service';
import { guardianSystemPrompt } from '../../prompts';
import { queryPolicies, getMandatoryGap, CATEGORY_ZH } from '../../insurance-store';
import { MODEL, fetchAccountantData, queryInsuranceRag } from './shared';

export const analyzeRouter = Router();

analyzeRouter.post('/', async (req: Request, res: Response) => {
  const { year } = req.body as { year?: number };
  const targetYear = year ?? new Date().getFullYear();
  const traceId = crypto.randomUUID();

  logger.info(`[Guardian/analyze] year=${targetYear} trace=${traceId}`);

  const [coData, peData, faData, activePolicies, mandatoryGap] = await Promise.all([
    fetchAccountantData('co_construction', targetYear),
    fetchAccountantData('personal', targetYear),
    fetchAccountantData('family', targetYear),
    queryPolicies({ status: 'active', limit: 200 }),
    getMandatoryGap(),
  ]);

  const ragContext = await queryInsuranceRag('工程公司必備保險 個人壽險規劃 職災補償');

  const activeSummary = activePolicies.slice(0, 20).map(p =>
    `${CATEGORY_ZH[p.category]} | ${p.insurer} | 保額 NT$${p.sum_insured.toLocaleString()} | 年繳 NT$${p.annual_premium.toLocaleString()}`
  ).join('\n') || '（尚未登錄任何保單）';

  const mandatoryMissing = mandatoryGap.missing.map(c => `⚠️ 強制缺失：${CATEGORY_ZH[c]}`).join('\n') || '（強制保險全數到位）';
  const totalPremium = activePolicies.reduce((s, p) => s + p.annual_premium, 0);

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
