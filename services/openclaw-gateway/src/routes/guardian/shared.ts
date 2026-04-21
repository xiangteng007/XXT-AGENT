import { type EntityType } from '../../insurance-store';

export const AGENT_ID = 'guardian';
export const MODEL = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';
export const REGULATION_RAG_URL = process.env['REGULATION_RAG_URL'] ?? 'http://localhost:8092';
export const ACCOUNTANT_URL = process.env['OPENCLAW_GATEWAY_URL'] ?? 'http://localhost:3100';

export async function queryInsuranceRag(question: string): Promise<string> {
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

export async function fetchAccountantData(entity_type?: EntityType, year?: number): Promise<{
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
