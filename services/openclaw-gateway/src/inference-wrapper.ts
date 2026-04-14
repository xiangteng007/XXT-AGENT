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

// ── AI-02: Fallback Chain 設定 ────────────────────────────────────
// 主模型 → 降級模型 → 本地 Ollama
const CLOUD_MODEL_CHAIN = [
  process.env['AI_PRIMARY_MODEL']   ?? 'gemini-2.5-flash',        // 主模型
  process.env['AI_FALLBACK_MODEL']  ?? 'gemini-2.0-flash',        // 降級雲端模型
];
const LOCAL_FALLBACK_MODEL = process.env['OLLAMA_L1_MODEL'] ?? 'qwen3:14b';

// A-2: 雙 Ollama 節點設定（P3 SPOF 消除）
const OLLAMA_PRIMARY = process.env['OLLAMA_PRIMARY'] ?? process.env['LOCAL_RUNNER_BASE_URL'] ?? 'http://localhost:11434';
const OLLAMA_BACKUP  = process.env['OLLAMA_BACKUP']  ?? '';          // 不設則不啟用備用
const OLLAMA_PROBE_TIMEOUT_MS = 2_500;                              // Probe 超時（不影響主要推理）

/**
 * A-2: 意圖 Ollama 健康探针 (HEAD /)，回傳 baseUrl or null
 */
async function probeOllama(baseUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(OLLAMA_PROBE_TIMEOUT_MS),
    });
    return res.ok ? baseUrl : null;
  } catch {
    return null;
  }
}

/**
 * A-2: 選擇可用的本地推理 Runner
 * 順序: OLLAMA_PRIMARY → OLLAMA_BACKUP → 拋出 ERROR
 */
async function resolveLocalRunner(): Promise<string> {
  const primary = await probeOllama(OLLAMA_PRIMARY);
  if (primary) return primary;

  logger.warn('[OllamaHA] Primary Ollama unreachable, probing backup...');
  if (OLLAMA_BACKUP) {
    const backup = await probeOllama(OLLAMA_BACKUP);
    if (backup) {
      logger.warn(`[OllamaHA] Using backup Ollama: ${OLLAMA_BACKUP}`);
      return backup;
    }
  }

  throw new Error('LOCAL_RUNNER_UNAVAILABLE: both primary and backup Ollama are down');
}

/** A-2: 導出本地 runner 狀態（用於 /health 端點） */
export async function getOllamaStatus(): Promise<{ primary: boolean; backup: boolean }> {
  const [p, b] = await Promise.all([
    probeOllama(OLLAMA_PRIMARY),
    OLLAMA_BACKUP ? probeOllama(OLLAMA_BACKUP) : Promise.resolve(null),
  ]);
  return { primary: p !== null, backup: b !== null };
}

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
    const localBase = await resolveLocalRunner();              // A-2: HA 路由
    const result = await ollamaChat(messages as OllamaMessage[], LOCAL_FALLBACK_MODEL, {
      temperature: options.temperature,
      num_predict: options.num_predict,
      thinking: options.thinking,
    }, localBase);
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
    const localBase = await resolveLocalRunner();              // A-2: HA 路由
    const ollamaOpts: Record<string, unknown> = {};
    if (options.temperature !== undefined) ollamaOpts['temperature'] = options.temperature;
    if (options.num_predict !== undefined) ollamaOpts['num_predict'] = options.num_predict;
    if (options.thinking !== undefined) ollamaOpts['thinking'] = options.thinking;

    const result = await ollamaChat(messages as OllamaMessage[], LOCAL_FALLBACK_MODEL, ollamaOpts, localBase);
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
