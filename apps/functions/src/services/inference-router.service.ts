/**
 * Inference Router Service
 *
 * Classifies user messages and routes them to the appropriate inference backend:
 *   - LOCAL  → Ollama on RTX 4080 (zero cloud cost)
 *   - CLOUD  → Gemini / OpenAI (live data, complex reasoning)
 *   - HYBRID → Local generation + cloud data enrichment
 *
 * Routing priority: LOCAL → (fallback) CLOUD
 */

import { logger } from 'firebase-functions/v2';
import {
    ollamaChat,
    ollamaGenerate,
    selectLocalModel,
    OllamaUnavailableError,
    OllamaMessage,
} from './local-inference.service';
import { getAgentPrompt } from './butler-ai.service';

// ================================
// Types
// ================================

export type InferenceBackend = 'local' | 'cloud' | 'hybrid';

export interface RoutingDecision {
    backend: InferenceBackend;
    reason: string;
    /** True if the task strictly requires real-time external data */
    requiresLiveData: boolean;
}

export interface LocalInferenceResult {
    text: string;
    backend: 'local' | 'cloud';
    model: string;
}

// ================================
// Task Classification Rules
// ================================

/**
 * Patterns that REQUIRE cloud API (live data, vision, financial accuracy)
 */
const CLOUD_REQUIRED_PATTERNS: RegExp[] = [
    /股價|股市|大盤|漲跌|K線|技術分析|即時報價/,
    /今天.*新聞|最新.*新聞|即時.*新聞/,
    /匯率|外幣|美金|日圓|歐元.*今/,
    /收據|發票|照片|圖片|OCR/,
    /天氣|氣象|降雨/,
    /\/(price|invest|report)\b/,
];

/**
 * Agent types that always need cloud precision
 */
const CLOUD_REQUIRED_AGENTS = new Set(['investment']);

/**
 * Patterns that are safe for local inference
 */
const LOCAL_SAFE_PATTERNS: RegExp[] = [
    /你好|哈囉|早安|晚安|謝謝|再見/,
    /行程|待辦|提醒|安排/,
    /健康|睡眠|運動|體重|卡路里/,
    /討論|分析|建議|規劃|怎麼看/,
    /幫我|請問|什麼是|解釋|說明/,
    /摘要|總結|反思|回顧/,
    /車|Jimny|保養|油耗/,
    /貸款|利率計算|還款/,
    /工程|建築|設計|BIM|圖面/,
];

// ================================
// Router Logic
// ================================

/**
 * Classify a user message to determine the best inference backend.
 */
export function classifyTask(message: string, agentId: string = 'butler'): RoutingDecision {
    const msg = message.toLowerCase();

    // Agent-level override: investment always uses cloud for live data
    if (CLOUD_REQUIRED_AGENTS.has(agentId)) {
        return {
            backend: 'cloud',
            reason: `agent=${agentId} requires live market data`,
            requiresLiveData: true,
        };
    }

    // Check cloud-required patterns
    for (const pattern of CLOUD_REQUIRED_PATTERNS) {
        if (pattern.test(message)) {
            return {
                backend: 'cloud',
                reason: `matches cloud-required pattern: ${pattern.source.slice(0, 30)}`,
                requiresLiveData: true,
            };
        }
    }

    // Check local-safe patterns
    for (const pattern of LOCAL_SAFE_PATTERNS) {
        if (pattern.test(message)) {
            return {
                backend: 'local',
                reason: `matches local-safe pattern: ${pattern.source.slice(0, 30)}`,
                requiresLiveData: false,
            };
        }
    }

    // Default: try local first (fallback to cloud if Ollama unavailable)
    return {
        backend: 'local',
        reason: 'default local-first policy',
        requiresLiveData: false,
    };
}

// ================================
// Routed Inference Entry Points
// ================================

/**
 * Route a chat message through local Ollama first, fallback to cloud callback.
 *
 * @param message      User message
 * @param agentId      Active agent (determines model + system prompt)
 * @param history      Previous conversation messages (last N turns)
 * @param cloudFallback  Async function to call Gemini/OpenAI when local fails
 */
export async function routedChat(
    message: string,
    agentId: string,
    history: string[],
    cloudFallback: () => Promise<string>
): Promise<LocalInferenceResult> {
    const decision = classifyTask(message, agentId);

    logger.info(`[Router] agent=${agentId} backend=${decision.backend} reason="${decision.reason}"`);

    // Force cloud if task requires live data
    if (decision.backend === 'cloud' || decision.requiresLiveData) {
        const text = await cloudFallback();
        return { text, backend: 'cloud', model: 'gemini/openai' };
    }

    // Try local Ollama
    try {
        const model = selectLocalModel(agentId);
        const systemPrompt = getAgentPrompt(agentId);

        const messages: OllamaMessage[] = [
            { role: 'system', content: systemPrompt },
        ];

        // Inject last 3 turns of history
        const recentHistory = history.slice(-6); // 3 exchanges = 6 lines
        for (let i = 0; i < recentHistory.length - 1; i += 2) {
            if (recentHistory[i]) {
                messages.push({ role: 'user', content: recentHistory[i] });
            }
            if (recentHistory[i + 1]) {
                messages.push({ role: 'assistant', content: recentHistory[i + 1] });
            }
        }

        messages.push({ role: 'user', content: message });

        const text = await ollamaChat(messages, model);
        return { text, backend: 'local', model };

    } catch (err) {
        if (err instanceof OllamaUnavailableError) {
            logger.warn(`[Router] Ollama unavailable (${err.message}), falling back to cloud`);
            const text = await cloudFallback();
            return { text, backend: 'cloud', model: 'gemini-fallback' };
        }
        throw err;
    }
}

/**
 * Route a summarization task (used by /reflect).
 * Almost always runs locally — summarization is pure computation.
 */
export async function routedSummarize(
    content: string,
    systemInstruction: string,
    cloudFallback: () => Promise<string>
): Promise<LocalInferenceResult> {
    try {
        const text = await ollamaGenerate(
            content,
            systemInstruction,
            'qwen2.5',
            { temperature: 0.3, num_predict: 600 }
        );
        return { text, backend: 'local', model: 'qwen2.5' };
    } catch (err) {
        if (err instanceof OllamaUnavailableError) {
            logger.warn('[Router] Ollama unavailable for summarize, using cloud');
            const text = await cloudFallback();
            return { text, backend: 'cloud', model: 'gemini-fallback' };
        }
        throw err;
    }
}

/**
 * Route a multi-agent discussion turn.
 * Each agent calls this independently; local model handles most turns.
 */
export async function routedAgentTurn(
    agentId: string,
    topic: string,
    systemPrompt: string,
    cloudFallback: () => Promise<string>
): Promise<LocalInferenceResult> {
    // Investment agent always uses cloud for market discussions
    if (CLOUD_REQUIRED_AGENTS.has(agentId)) {
        const text = await cloudFallback();
        return { text, backend: 'cloud', model: 'gemini/openai' };
    }

    try {
        const model = selectLocalModel(agentId);
        const messages: OllamaMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `請就以下主題提供你的專業觀點：\n\n${topic}` },
        ];
        const text = await ollamaChat(messages, model, { temperature: 0.8, num_predict: 512 });
        return { text, backend: 'local', model };
    } catch (err) {
        if (err instanceof OllamaUnavailableError) {
            logger.warn(`[Router] Ollama unavailable for agent ${agentId}, using cloud`);
            const text = await cloudFallback();
            return { text, backend: 'cloud', model: 'gemini-fallback' };
        }
        throw err;
    }
}
