/**
 * accountant/helpers.ts — 會計師 Agent 工具函數
 *
 * CR-02: 從巨型路由檔中抽離 RAG 查詢等純函數邏輯。
 */

import { logger } from '../../logger';

// ── 設定 ──────────────────────────────────────────────────────
const REGULATION_RAG_URL = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';

/** 查詢法規 RAG（Retrieval Augmented Generation）*/
export async function queryRag(
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

/** 偵測 prompt 是否需要查詢法規 RAG */
export function detectRagCategory(
  text: string,
): 'tax' | 'labor' | null {
  const t = text.toLowerCase();
  const taxKeywords = ['發票', '統一發票', '營業稅', '扣繳', '所得稅', '申報', '稅率', '稅額', '含稅', '未稅', '免稅', '零稅率', '進項', '銷項'];
  const laborKeywords = ['薪資', '勞保', '健保', '勞退', '加班', '特休', '年假', '資遣', '退職', '職災', '勞基法', '工資'];

  if (taxKeywords.some(k => t.includes(k))) return 'tax';
  if (laborKeywords.some(k => t.includes(k))) return 'labor';
  return null;
}

/** Agent 常用設定 */
export const AGENT_ID = 'accountant';
export const MODEL = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';

import { Response } from 'express';

// ── 工具函數：處理統一錯誤 ──────────────────────────────────────
export function handleAccountantError(res: Response, contextMsg: string, err: unknown) {
  logger.error(`[Accountant] ${contextMsg} Error: ${err}`);
  res.status(500).json({
    ok: false,
    error: 'AGENT_SERVICE_FAILURE',
    message: contextMsg,
    details: err instanceof Error ? err.message : String(err),
    resolution: 'Please verify Ollama/Firebase availability and try again later.'
  });
}
