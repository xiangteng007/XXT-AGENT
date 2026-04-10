/**
 * Ollama Inference Service — M5: Deliberation L1
 *
 * 封裝對本地 Ollama 的呼叫，用於 L1 Deliberation（本地快速討論）。
 * 若 Local Runner 不可用則拋出 OllamaUnavailableError（由呼叫方降級到 L2）。
 *
 * 硬體基準（主機 SENTENG）:
 *   GPU: RTX 4080 SUPER 16GB VRAM
 *   RAM: 64GB DDR5 5600MHz
 *   CPU: Intel Core Ultra 9 285K (24 cores)
 */

import { logger } from './logger';

// ── 設定 ──────────────────────────────────────────────────────
const OLLAMA_BASE = process.env['LOCAL_RUNNER_BASE_URL'] ?? 'http://localhost:11434';
const OLLAMA_TIMEOUT_MS = parseInt(process.env['OLLAMA_TIMEOUT_MS'] ?? '30000');

// ── 模型選型（基於 RTX 4080 SUPER 16GB VRAM）────────────────
// qwen3:14b         ~9GB VRAM  → L1 通用推理，~50 tok/s
// qwen3-coder:30b-a3b ~13GB VRAM → L1 程式碼（MoE 架構），~30 tok/s
const DEFAULT_L1_MODEL    = process.env['OLLAMA_L1_MODEL']    ?? 'qwen3:14b';
const DEFAULT_CODER_MODEL = process.env['OLLAMA_CODER_MODEL'] ?? 'qwen3-coder:30b-a3b';

// keep_alive 控制：模型在 VRAM 中保留的時間（秒）
// 設為 '0' 表示推理完成後立即卸載（釋放 VRAM）
const DEFAULT_KEEP_ALIVE  = process.env['OLLAMA_KEEP_ALIVE']  ?? '5m';

// ── 型別 ──────────────────────────────────────────────────────
export interface OllamaMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OllamaChatResponse {
    model: string;
    message: { role: string; content: string };
    done: boolean;
    total_duration?: number;
    eval_count?: number;
}

export class OllamaUnavailableError extends Error {
    constructor(reason: string) {
        super(`Ollama unavailable: ${reason}`);
        this.name = 'OllamaUnavailableError';
    }
}

// ── 型別補充 ──────────────────────────────────────────────────
export interface OllamaModelInfo {
    name: string;
    size: number;        // bytes
    digest: string;
    details?: { parameter_size?: string; quantization_level?: string };
}

export interface OllamaRunningModel {
    name: string;
    size: number;        // VRAM 佔用 bytes
    size_vram: number;
    expires_at: string;
}

// ── 主要推理函數 ──────────────────────────────────────────────
/**
 * 呼叫 Ollama /api/chat（非串流）
 *
 * @param messages   - 對話歷史
 * @param model      - 使用哪個本地模型（預設 qwen3:14b）
 * @param options    - 模型參數（temperature, num_predict 等）
 * @param keepAlive  - 模型在 VRAM 保留時間，'0' 表示推理後立即卸載
 *
 * ⚠️  Qwen3 Thinking Mode 防護：
 *     系統 prompt 中自動注入 /no_think，避免 Thinking Mode 佔用大量 token
 *     導致 L1 Deliberation 超時。若需要 Thinking，請在 options 傳入
 *     { thinking: true } 並自行控制超時。
 */
export async function ollamaChat(
    messages: OllamaMessage[],
    model: string = DEFAULT_L1_MODEL,
    options?: Record<string, unknown>,
    keepAlive: string = DEFAULT_KEEP_ALIVE,
): Promise<{ content: string; model: string; latency_ms: number }> {
    const start = Date.now();

    // ── Qwen3 Thinking Mode 防護 ──────────────────────────────
    // 若模型為 qwen3 系列且未明確要求 thinking，在最後一個 user message 注入 /no_think
    const isQwen3 = model.startsWith('qwen3');
    const wantsThinking = options?.['thinking'] === true;
    let processedMessages = messages;
    if (isQwen3 && !wantsThinking) {
        processedMessages = messages.map((m, idx) => {
            if (m.role === 'user' && idx === messages.length - 1) {
                // 附加 /no_think 指令，關閉 Extended Thinking
                return { ...m, content: m.content + '\n/no_think' };
            }
            return m;
        });
    }

    // 從 options 中移除自定義的 thinking 旗標，避免傳入 Ollama
    const { thinking: _thinking, ...ollamaOptions } = (options ?? {}) as Record<string, unknown>;

    let response: Response;
    try {
        response = await fetch(`${OLLAMA_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: processedMessages,
                stream: false,
                keep_alive: keepAlive,
                options: {
                    temperature: 0.7,
                    num_predict: 512,
                    ...ollamaOptions,
                },
            }),
            signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
        });
    } catch (err) {
        throw new OllamaUnavailableError(
            err instanceof Error ? err.message : String(err),
        );
    }

    if (!response.ok) {
        throw new OllamaUnavailableError(`HTTP ${response.status}`);
    }

    let data: OllamaChatResponse;
    try {
        data = await response.json() as OllamaChatResponse;
    } catch {
        throw new OllamaUnavailableError('Invalid JSON response');
    }

    const latency_ms = Date.now() - start;
    logger.info(`[Ollama] ${model} responded in ${latency_ms}ms (eval=${data.eval_count ?? '?'}, keep_alive=${keepAlive})`);

    return {
        content: data.message.content,
        model: data.model,
        latency_ms,
    };
}

// ── VRAM 管理函數 ────────────────────────────────────────────
/**
 * 取得目前 Ollama 中正在運行（佔用 VRAM）的模型清單
 */
export async function getRunningModels(): Promise<OllamaRunningModel[]> {
    try {
        const res = await fetch(`${OLLAMA_BASE}/api/ps`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const data = await res.json() as { models?: OllamaRunningModel[] };
        return data.models ?? [];
    } catch {
        return [];
    }
}

/**
 * 強制卸載指定模型（keep_alive=0），立即釋放其 VRAM
 * @param modelName - 要卸載的模型名稱（e.g. 'qwen3:14b'）
 */
export async function unloadModel(modelName: string): Promise<void> {
    logger.info(`[Ollama VRAM] Unloading model: ${modelName}`);
    try {
        // 發送一個空的 generate 請求，keep_alive=0 觸發立即卸載
        await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelName,
                prompt: '',
                keep_alive: 0,
            }),
            signal: AbortSignal.timeout(10000),
        });
        logger.info(`[Ollama VRAM] Unloaded: ${modelName}`);
    } catch (err) {
        logger.warn(`[Ollama VRAM] Failed to unload ${modelName}: ${String(err)}`);
    }
}

/**
 * 一鍵釋放所有 Ollama 佔用的 VRAM
 * 對所有目前在 /api/ps 列表中的模型呼叫 keep_alive=0
 * @returns 已卸載的模型名稱清單
 */
export async function freeAllVRAM(): Promise<{ unloaded: string[]; failed: string[] }> {
    const running = await getRunningModels();
    if (running.length === 0) {
        logger.info('[Ollama VRAM] No models loaded, VRAM already free.');
        return { unloaded: [], failed: [] };
    }

    logger.info(`[Ollama VRAM] Freeing ${running.length} model(s): ${running.map(m => m.name).join(', ')}`);

    const results = await Promise.allSettled(
        running.map(m => unloadModel(m.name)),
    );

    const unloaded: string[] = [];
    const failed: string[] = [];
    results.forEach((r, i) => {
        if (r.status === 'fulfilled') unloaded.push(running[i]!.name);
        else failed.push(running[i]!.name);
    });

    logger.info(`[Ollama VRAM] Free complete — unloaded: [${unloaded.join(', ')}], failed: [${failed.join(', ')}]`);
    return { unloaded, failed };
}

/**
 * L1 快速意見（用於 Deliberation.OPINION 事件）
 * 使用 qwen3:14b，/no_think 模式，低延遲
 */
export async function generateL1Opinion(
    agentId: string,
    topic: string,
    context: string,
    priorTurns: string,
): Promise<string> {
    const system = `你是 "${agentId}"，一個 AI 數位員工。
用繁體中文簡短回答（100 字以內），針對以下議題提供你的觀點。
直接給出結論，不需要前言。`;

    const userContent = `議題：${topic}\n\n背景：${context}${
        priorTurns ? `\n\n其他 Agent 意見：\n${priorTurns}` : ''
    }\n\n你的觀點：`;

    const result = await ollamaChat(
        [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
        ],
        DEFAULT_L1_MODEL,
        { temperature: 0.6, num_predict: 200 },  // thinking: false（預設 /no_think）
    );

    return result.content;
}

/**
 * L1 程式碼相關任務（使用 Coder 模型）
 */
export async function generateL1Code(
    prompt: string,
    language = 'TypeScript',
): Promise<string> {
    const result = await ollamaChat(
        [
            {
                role: 'system',
                content: `你是一個專業的 ${language} 程式設計師。只回傳程式碼，不需要說明。`,
            },
            { role: 'user', content: prompt },
        ],
        DEFAULT_CODER_MODEL,
        { temperature: 0.2, num_predict: 1024 },
    );
    return result.content;
}

export { DEFAULT_L1_MODEL, DEFAULT_CODER_MODEL, DEFAULT_KEEP_ALIVE };
