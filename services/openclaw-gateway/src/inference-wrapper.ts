import * as crypto from 'crypto';
import { logger } from './logger';
import { PrivacyRouter, PrivacyClassification } from './privacy-router';
import { wrapWithAudit } from './audit-logger';
import { ollamaChat, OllamaMessage } from './ollama-inference.service';

export interface InferenceOptions {
  agentId: string;
  action?: string;
  sessionId?: string;
  userId?: string;
  temperature?: number;
  num_predict?: number;
  thinking?: boolean;
}

export type AgentMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface AgentChatResponse {
  content: string;
  model: string;
  latency_ms: number;
  /** 是否使用了 fallback（方便監控） */
  used_fallback?: boolean;
  fallback_reason?: string;
}

// ── AI-02: Fallback Chain 設定 ────────────────────────────────
// 主模型 → 降級模型 → 本地 Ollama
const CLOUD_MODEL_CHAIN = [
  process.env['AI_PRIMARY_MODEL']   ?? 'gemini-2.5-flash',        // 主模型
  process.env['AI_FALLBACK_MODEL']  ?? 'gemini-2.0-flash',        // 降級雲端模型
];
const LOCAL_FALLBACK_MODEL = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';

/**
 * 嘗試呼叫雲端 AI Gateway（OpenAI-compatible 格式）
 * 失敗時丟出 Error，交由 callWithFallbackChain 處理
 */
async function callCloudModel(
  endpoint: string,
  model: string,
  messages: AgentMessage[],
  options: InferenceOptions,
): Promise<AgentChatResponse> {
  const authHeader = {
    Authorization: `Bearer ${process.env['OPENCLAW_API_KEY'] ?? 'dev-secret-key'}`,
  };

  const start = Date.now();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.num_predict ?? 2048,
    }),
    signal: AbortSignal.timeout(30_000), // 30s timeout per attempt
  });

  if (!res.ok) {
    throw new Error(`Cloud AI Error: [${model}] ${res.status} ${res.statusText}`);
  }

  interface CloudAIResponse {
    choices?: Array<{ message?: { content?: string } }>;
  }
  const data = await res.json() as CloudAIResponse;
  const content = data.choices?.[0]?.message?.content ?? '';

  return { content, model, latency_ms: Date.now() - start };
}

/**
 * AI-02: Fallback Chain 執行器
 *
 * 執行順序：
 *   1. 嘗試 CLOUD_MODEL_CHAIN[0]（主模型）
 *   2. 若失敗 → 嘗試 CLOUD_MODEL_CHAIN[1]（降級模型）
 *   3. 若 PRIVATE 或全部雲端失敗 → 本地 Ollama
 */
async function callWithFallbackChain(
  endpoint: string,
  messages: AgentMessage[],
  options: InferenceOptions,
  classification: PrivacyClassification,
): Promise<AgentChatResponse> {
  // PRIVATE 資料：直接走本地，不嘗試雲端
  if (classification.routeTo === 'local') {
    const result = await ollamaChat(messages as OllamaMessage[], LOCAL_FALLBACK_MODEL, {
      temperature: options.temperature,
      num_predict: options.num_predict,
      thinking: options.thinking,
    });
    return result;
  }

  const errors: string[] = [];

  // 嘗試雲端模型 Fallback Chain
  for (const model of CLOUD_MODEL_CHAIN) {
    try {
      const result = await callCloudModel(endpoint, model, messages, options);
      const isFirst = model === CLOUD_MODEL_CHAIN[0];
      logger.debug(`[FallbackChain] Success with ${model}${isFirst ? '' : ' (fallback)'}`);
      return {
        ...result,
        used_fallback: !isFirst,
        fallback_reason: isFirst ? undefined : errors.join(' | '),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      logger.warn(`[FallbackChain] ${model} failed, trying next: ${msg}`);
    }
  }

  // 所有雲端模型失敗 → Ollama 本地 fallback（僅限 PUBLIC/INTERNAL）
  logger.warn(`[FallbackChain] All cloud models failed, falling back to local Ollama: ${errors.join(' | ')}`);
  try {
    const ollamaOpts: Record<string, unknown> = {};
    if (options.temperature !== undefined) ollamaOpts['temperature'] = options.temperature;
    if (options.num_predict !== undefined) ollamaOpts['num_predict'] = options.num_predict;
    if (options.thinking !== undefined) ollamaOpts['thinking'] = options.thinking;

    const result = await ollamaChat(messages as OllamaMessage[], LOCAL_FALLBACK_MODEL, ollamaOpts);
    return {
      ...result,
      used_fallback: true,
      fallback_reason: `All cloud failed: ${errors.join(' | ')}`,
    };
  } catch (localErr) {
    const localMsg = localErr instanceof Error ? localErr.message : String(localErr);
    throw new Error(`All inference providers failed. Cloud: [${errors.join(', ')}]. Local: ${localMsg}`);
  }
}

/**
 * 全域統一推理中介層 (Inference Wrapper)
 *
 * 流程：
 * 1. 攔截請求，送入 PrivacyRouter 判斷隱私等級
 * 2. 決定路由（Ollama 或 Cloud AI Gateway）
 * 3. AI-02: 帶 Fallback Chain 呼叫底層模型
 * 4. 利用 AuditLogger 全程記錄
 */
export async function agentChat(
  messages: AgentMessage[],
  options: InferenceOptions,
): Promise<AgentChatResponse> {
  const promptStr = messages.map((m) => m.content).join('\n');
  const classification = PrivacyRouter.classify(promptStr);
  const traceId = crypto.randomUUID();
  const inputPreview = PrivacyRouter.redactForLog(promptStr, classification.level);

  const endpoint = PrivacyRouter.resolveEndpoint(classification);
  // AI-02: 初始模型從 chain 第一個取得（Fallback Chain 內部會依序嘗試）
  const model = CLOUD_MODEL_CHAIN[0];
  const action = options.action ?? 'AGENT_CHAT';

  const meta = {
    agentId: options.agentId,
    action,
    classification,
    inputPreview,
    traceId,
    sessionId: options.sessionId,
    userId: options.userId,
    model,
  };

  logger.info(
    `[InferenceWrapper] trace=${traceId} agent=${options.agentId} privacy=${classification.level} -> ${classification.routeTo} (chain: ${CLOUD_MODEL_CHAIN.join(' → ')} → ollama)`,
  );

  return wrapWithAudit(meta, () =>
    callWithFallbackChain(endpoint, messages, options, classification)
  );
}
