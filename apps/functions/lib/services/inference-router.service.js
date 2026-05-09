"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyTask = classifyTask;
exports.routedChat = routedChat;
exports.routedChatStream = routedChatStream;
exports.routedSummarize = routedSummarize;
exports.routedAgentTurn = routedAgentTurn;
const v2_1 = require("firebase-functions/v2");
const local_inference_service_1 = require("./local-inference.service");
const butler_ai_service_1 = require("./butler-ai.service");
const local_tool_parser_service_1 = require("./local-tool-parser.service");
// ================================
// Task Classification Rules
// ================================
/**
 * Patterns that REQUIRE cloud API (live data, vision, financial accuracy)
 */
const CLOUD_REQUIRED_PATTERNS = [
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
 * SENSITIVE_TOOL_PATTERNS: imported from local-tool-parser.service.ts (single source of truth).
 * These patterns MUST stay local due to sensitive personal data.
 * Listed in LOCAL_SAFE_PATTERNS to ensure classifyTask() never
 * accidentally sends them to Gemini/OpenAI.
 */
/**
 * Patterns that are safe for local inference (conversational)
 */
const LOCAL_SAFE_PATTERNS = [
    ...local_tool_parser_service_1.SENSITIVE_TOOL_PATTERNS, // sensitive ops always route local (imported)
    /你好|哈囉|早安|晚安|謝謝|再見/,
    /行程|待辦|提醒|安排/,
    /健康|睡眠|運動|體重|卡路里/,
    /討論|分析|建議|規劃|怎麼看/,
    /幫我|請問|什麼是|解釋|說明/,
    /摘要|總結|反思|回顧/,
    /車|Jimny|保養|油耗/,
    /貸款|利率計算|還款/,
    /工程|建築|設計|BIM|圖面/,
    // MPE — fully local (quantitative math, Ollama only)
    /\/signal|\/mpe|\/predict|\/backtest/,
    /市場預測|交易訊號|MPE|蒙特卡洛|量化指標|風險報酬/,
    /Hurst|Shannon|VIX|DXY|美債/,
];
// ================================
// Router Logic
// ================================
/**
 * Classify a user message to determine the best inference backend.
 */
function classifyTask(message, agentId = 'butler') {
    const msgLower = message.toLowerCase();
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
        if (pattern.test(msgLower)) {
            return {
                backend: 'cloud',
                reason: `matches cloud-required pattern: ${pattern.source.slice(0, 30)}`,
                requiresLiveData: true,
            };
        }
    }
    // Check local-safe patterns
    for (const pattern of LOCAL_SAFE_PATTERNS) {
        if (pattern.test(msgLower)) {
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
async function routedChat(message, agentId, history, cloudFallback) {
    const decision = classifyTask(message, agentId);
    v2_1.logger.info(`[Router] agent=${agentId} backend=${decision.backend} reason="${decision.reason}"`);
    // Force cloud if task requires live data
    if (decision.backend === 'cloud' || decision.requiresLiveData) {
        const text = await cloudFallback();
        return { text, backend: 'cloud', model: 'gemini/openai' };
    }
    // Try local Ollama
    try {
        const model = (0, local_inference_service_1.selectLocalModel)(agentId);
        const systemPrompt = (0, butler_ai_service_1.getAgentPrompt)(agentId);
        const messages = [
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
        const text = await (0, local_inference_service_1.ollamaChat)(messages, model);
        return { text, backend: 'local', model };
    }
    catch (err) {
        if (err instanceof local_inference_service_1.OllamaUnavailableError) {
            v2_1.logger.warn(`[Router] Ollama unavailable (${err.message}), falling back to cloud`);
            const text = await cloudFallback();
            return { text, backend: 'cloud', model: 'gemini-fallback' };
        }
        throw err;
    }
}
/**
 * Streaming version of routedChat — yields progressive StreamChunks.
 *
 * If local Ollama is available, streams tokens in real-time.
 * If cloud fallback is needed, yields a single final chunk (no streaming).
 */
async function* routedChatStream(message, agentId, history, cloudFallback) {
    const decision = classifyTask(message, agentId);
    v2_1.logger.info(`[Router] stream agent=${agentId} backend=${decision.backend} reason="${decision.reason}"`);
    // Force cloud if task requires live data
    if (decision.backend === 'cloud' || decision.requiresLiveData) {
        const text = await cloudFallback();
        yield { text, delta: text, done: true, backend: 'cloud', model: 'gemini/openai' };
        return;
    }
    // Try local Ollama streaming
    try {
        const model = (0, local_inference_service_1.selectLocalModel)(agentId);
        const systemPrompt = (0, butler_ai_service_1.getAgentPrompt)(agentId);
        const messages = [
            { role: 'system', content: systemPrompt },
        ];
        const recentHistory = history.slice(-6);
        for (let i = 0; i < recentHistory.length - 1; i += 2) {
            if (recentHistory[i])
                messages.push({ role: 'user', content: recentHistory[i] });
            if (recentHistory[i + 1])
                messages.push({ role: 'assistant', content: recentHistory[i + 1] });
        }
        messages.push({ role: 'user', content: message });
        for await (const chunk of (0, local_inference_service_1.ollamaChatStream)(messages, model)) {
            yield { ...chunk, backend: 'local', model };
        }
    }
    catch (err) {
        if (err instanceof local_inference_service_1.OllamaUnavailableError) {
            v2_1.logger.warn(`[Router] Ollama stream unavailable (${err.message}), falling back to cloud`);
            const text = await cloudFallback();
            yield { text, delta: text, done: true, backend: 'cloud', model: 'gemini-fallback' };
            return;
        }
        throw err;
    }
}
/**
 * Route a summarization task (used by /reflect).
 * Almost always runs locally — summarization is pure computation.
 */
async function routedSummarize(content, systemInstruction, cloudFallback) {
    try {
        const text = await (0, local_inference_service_1.ollamaGenerate)(content, systemInstruction, 'qwen3:14b', { temperature: 0.3, num_predict: 600 });
        return { text, backend: 'local', model: 'qwen3:14b' };
    }
    catch (err) {
        if (err instanceof local_inference_service_1.OllamaUnavailableError) {
            v2_1.logger.warn('[Router] Ollama unavailable for summarize, using cloud');
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
async function routedAgentTurn(agentId, topic, systemPrompt, cloudFallback) {
    // Investment agent always uses cloud for market discussions
    if (CLOUD_REQUIRED_AGENTS.has(agentId)) {
        const text = await cloudFallback();
        return { text, backend: 'cloud', model: 'gemini/openai' };
    }
    try {
        const model = (0, local_inference_service_1.selectLocalModel)(agentId);
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `請就以下主題提供你的專業觀點：\n\n${topic}` },
        ];
        const text = await (0, local_inference_service_1.ollamaChat)(messages, model, { temperature: 0.8, num_predict: 512 });
        return { text, backend: 'local', model };
    }
    catch (err) {
        if (err instanceof local_inference_service_1.OllamaUnavailableError) {
            v2_1.logger.warn(`[Router] Ollama unavailable for agent ${agentId}, using cloud`);
            const text = await cloudFallback();
            return { text, backend: 'cloud', model: 'gemini-fallback' };
        }
        throw err;
    }
}
//# sourceMappingURL=inference-router.service.js.map