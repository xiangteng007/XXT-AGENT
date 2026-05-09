"use strict";
/**
 * Local Inference Service
 *
 * Wraps the Ollama HTTP API running on the local RTX 4080 desktop.
 * Firebase Functions connects via direct public IP or a configurable OLLAMA_BASE_URL.
 *
 * Installed models (confirmed 2026-05-09):
 *   - gpt-oss:20b      → 20.9B MXFP4, primary reasoning model
 *   - qwen3:14b        → 14.8B Q4_K_M, Traditional Chinese conversations
 *   - nomic-embed-text → 137M F16, text embeddings for ChromaDB RAG
 *
 * Connection strategy:
 *   1. Read OLLAMA_BASE_URL from Firebase Secret / env
 *   2. Health check before each call (cached 30s)
 *   3. 90s timeout (14b/20b models need time); caller catches OllamaUnavailableError
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaUnavailableError = void 0;
exports.isOllamaAvailable = isOllamaAvailable;
exports.invalidateOllamaHealthCache = invalidateOllamaHealthCache;
exports.preWarmModel = preWarmModel;
exports.selectLocalModel = selectLocalModel;
exports.ollamaChat = ollamaChat;
exports.ollamaChatStream = ollamaChatStream;
exports.ollamaGenerate = ollamaGenerate;
exports.getAvailableModels = getAvailableModels;
exports.embedText = embedText;
const v2_1 = require("firebase-functions/v2");
class OllamaUnavailableError extends Error {
    constructor(reason) {
        super(`Ollama unavailable: ${reason}`);
        this.name = 'OllamaUnavailableError';
    }
}
exports.OllamaUnavailableError = OllamaUnavailableError;
// ================================
// Configuration
// ================================
/** OLLAMA_BASE_URL — Direct public IP or LAN address.
 *  Set in Firebase Secret Manager or .env.
 *  Examples:
 *    - http://122.117.154.34:11434             (public IP — current)
 *    - http://192.168.1.100:11434              (LAN direct)
 *    - http://localhost:11434                  (local emulator)
 */
function getOllamaBaseUrl() {
    return (process.env.OLLAMA_BASE_URL ||
        'http://localhost:11434' // fallback for local emulator testing
    );
}
const OLLAMA_TIMEOUT_MS = 90_000; // 90s – gpt-oss:20b / qwen3:14b on RTX 4080 SUPER
const HEALTH_TIMEOUT_MS = 25_000; // 25s – Cloud Run → public IP observed ~95ms cached / ~3.6s uncached
// ================================
// Health Check
// ================================
let _lastHealthCheck = 0;
let _lastHealthResult = false;
const HEALTH_CACHE_MS = 30_000; // cache health result for 30s (reduced from 60s for faster recovery)
/**
 * Check if Ollama is reachable.
 * Result is cached for 30s to avoid repeated requests on every inference call.
 */
async function isOllamaAvailable() {
    const now = Date.now();
    if (now - _lastHealthCheck < HEALTH_CACHE_MS) {
        return _lastHealthResult;
    }
    const baseUrl = getOllamaBaseUrl();
    const healthUrl = `${baseUrl}/api/tags`;
    const startMs = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
        const res = await fetch(healthUrl, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timeout);
        _lastHealthResult = res.ok;
        const elapsed = Date.now() - startMs;
        v2_1.logger.info(`[Ollama] Health check: ${_lastHealthResult ? '✅ online' : '❌ offline'} url=${healthUrl} status=${res.status} elapsed=${elapsed}ms`);
    }
    catch (err) {
        _lastHealthResult = false;
        const elapsed = Date.now() - startMs;
        const reason = err.name === 'AbortError' ? 'TIMEOUT' : err.message;
        v2_1.logger.warn(`[Ollama] Health check FAILED: url=${healthUrl} reason=${reason} elapsed=${elapsed}ms`);
    }
    _lastHealthCheck = now;
    return _lastHealthResult;
}
/**
 * Invalidate health cache (call after a failed inference to retry health next time)
 */
function invalidateOllamaHealthCache() {
    _lastHealthCheck = 0;
}
/**
 * Pre-warm a model into VRAM by sending a minimal generate request.
 * Call during Cloud Run startup to avoid first-request model loading delay (~10s).
 * Non-blocking: failures are silently ignored.
 */
async function preWarmModel(model = 'qwen3:14b') {
    const available = await isOllamaAvailable();
    if (!available)
        return false;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
        const res = await fetch(`${getOllamaBaseUrl()}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt: 'Hi',
                stream: false,
                options: { num_predict: 1 }, // generate just 1 token — fast warmup
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const ok = res.ok;
        v2_1.logger.info(`[Ollama] Pre-warm model=${model} status=${res.status} ok=${ok}`);
        return ok;
    }
    catch (err) {
        v2_1.logger.warn(`[Ollama] Pre-warm failed for ${model}:`, err.message);
        return false;
    }
}
// ================================
// Model Selection
// ================================
/**
 * Choose the best local model for a given agent.
 *
 * Installed on RTX 4080 SUPER (confirmed 2026-04-22):
 *   gpt-oss:20b   — 20.9B MXFP4, strong reasoning + English/Chinese
 *   qwen3:14b     — 14.8B Q4_K_M, Traditional Chinese specialist
 */
function selectLocalModel(agentId) {
    switch (agentId) {
        case 'investment':
        case 'accountant':
        case 'tax':
        case 'nexus':
        case 'vertex': // legal reasoning needs stronger model
            return 'gpt-oss:20b'; // heavier reasoning for financial / analytical / legal tasks
        case 'butler':
        case 'titan':
        case 'lumi':
        case 'rusty':
        default:
            return 'qwen3:14b'; // Traditional Chinese specialist for daily interactions
    }
}
// ================================
// Core Inference Functions
// ================================
/**
 * Chat-style inference with message history.
 * Preferred over generate() for multi-turn conversations.
 *
 * @throws OllamaUnavailableError if Ollama is offline or times out
 */
async function ollamaChat(messages, model = 'qwen3:14b', options) {
    const available = await isOllamaAvailable();
    if (!available) {
        throw new OllamaUnavailableError('health check failed');
    }
    const body = {
        model,
        messages,
        stream: false,
        options: {
            temperature: 0.7,
            num_predict: 1024,
            ...options,
        },
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
        invalidateOllamaHealthCache();
    }, OLLAMA_TIMEOUT_MS);
    try {
        const res = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!res.ok) {
            invalidateOllamaHealthCache();
            throw new OllamaUnavailableError(`HTTP ${res.status}`);
        }
        const data = (await res.json());
        const text = data.message?.content || data.response || '';
        const tokensGenerated = data.eval_count ?? 0;
        const durationMs = data.total_duration ? Math.round(data.total_duration / 1_000_000) : 0;
        v2_1.logger.info(`[Ollama] ✅ model=${model} tokens=${tokensGenerated} time=${durationMs}ms`);
        return text.trim();
    }
    catch (err) {
        if (err.name === 'AbortError') {
            throw new OllamaUnavailableError(`timeout after ${OLLAMA_TIMEOUT_MS / 1000}s`);
        }
        throw err;
    }
    finally {
        clearTimeout(timeout);
    }
}
/**
 * Streaming chat — yields text chunks as Ollama generates tokens.
 * Uses NDJSON streaming (Ollama's native `stream: true` format).
 *
 * Usage:
 * ```ts
 * for await (const chunk of ollamaChatStream(messages, model)) {
 *     // chunk.text = accumulated text so far
 *     // chunk.delta = new text in this chunk
 *     // chunk.done = true when complete
 * }
 * ```
 */
async function* ollamaChatStream(messages, model = 'qwen3:14b', options) {
    const available = await isOllamaAvailable();
    if (!available) {
        throw new OllamaUnavailableError('health check failed');
    }
    const body = {
        model,
        messages,
        stream: true,
        options: {
            temperature: 0.7,
            num_predict: 1024,
            ...options,
        },
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
        invalidateOllamaHealthCache();
    }, OLLAMA_TIMEOUT_MS);
    try {
        const res = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!res.ok) {
            invalidateOllamaHealthCache();
            throw new OllamaUnavailableError(`HTTP ${res.status}`);
        }
        if (!res.body) {
            throw new OllamaUnavailableError('no response body for streaming');
        }
        let accumulated = '';
        let tokenCount = 0;
        const decoder = new TextDecoder();
        // Node.js ReadableStream → async iteration over NDJSON lines
        const reader = res.body.getReader();
        let buffer = '';
        while (true) {
            const { done: readerDone, value } = await reader.read();
            if (readerDone)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // keep incomplete line in buffer
            for (const line of lines) {
                if (!line.trim())
                    continue;
                try {
                    const chunk = JSON.parse(line);
                    const delta = chunk.message?.content || chunk.response || '';
                    accumulated += delta;
                    tokenCount = chunk.eval_count ?? tokenCount;
                    yield {
                        text: accumulated,
                        delta,
                        done: chunk.done,
                        tokenCount: chunk.done ? tokenCount : undefined,
                    };
                    if (chunk.done) {
                        const durationMs = chunk.total_duration ? Math.round(chunk.total_duration / 1_000_000) : 0;
                        v2_1.logger.info(`[Ollama] ✅ stream model=${model} tokens=${tokenCount} time=${durationMs}ms`);
                    }
                }
                catch {
                    // skip malformed JSON lines
                }
            }
        }
    }
    catch (err) {
        if (err.name === 'AbortError') {
            throw new OllamaUnavailableError(`stream timeout after ${OLLAMA_TIMEOUT_MS / 1000}s`);
        }
        throw err;
    }
    finally {
        clearTimeout(timeout);
    }
}
/**
 * Single-turn generate (simpler, no history needed).
 * Used for summarization tasks like /reflect.
 *
 * @throws OllamaUnavailableError if Ollama is offline or times out
 */
async function ollamaGenerate(prompt, systemPrompt, model = 'qwen3:14b', options) {
    const available = await isOllamaAvailable();
    if (!available) {
        throw new OllamaUnavailableError('health check failed');
    }
    const body = {
        model,
        prompt,
        system: systemPrompt,
        stream: false,
        options: {
            temperature: 0.5, // lower temp for summarization
            num_predict: 800,
            ...options,
        },
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
        invalidateOllamaHealthCache();
    }, OLLAMA_TIMEOUT_MS);
    try {
        const res = await fetch(`${getOllamaBaseUrl()}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!res.ok) {
            invalidateOllamaHealthCache();
            throw new OllamaUnavailableError(`HTTP ${res.status}`);
        }
        const data = (await res.json());
        const text = data.response || '';
        v2_1.logger.info(`[Ollama] ✅ generate model=${model} done=${data.done}`);
        return text.trim();
    }
    catch (err) {
        if (err.name === 'AbortError') {
            throw new OllamaUnavailableError(`timeout after ${OLLAMA_TIMEOUT_MS / 1000}s`);
        }
        throw err;
    }
    finally {
        clearTimeout(timeout);
    }
}
/**
 * Get list of models available on this Ollama instance.
 * Used by /memory command to display available local models.
 */
async function getAvailableModels() {
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
        const res = await fetch(`${getOllamaBaseUrl()}/api/tags`, { signal: controller.signal });
        if (!res.ok)
            return [];
        const data = await res.json();
        return (data.models || []).map(m => m.name);
    }
    catch {
        return [];
    }
}
// ================================
// Embedding (nomic-embed-text)
// ================================
/**
 * Generate text embedding via local Ollama nomic-embed-text model.
 * Used for ChromaDB vector similarity search — all computation stays local.
 *
 * @returns Float array embedding, or null if Ollama is unavailable
 */
async function embedText(text) {
    const available = await isOllamaAvailable();
    if (!available)
        return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
        const res = await fetch(`${getOllamaBaseUrl()}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'nomic-embed-text',
                prompt: text,
            }),
            signal: controller.signal,
        });
        if (!res.ok) {
            v2_1.logger.warn(`[Ollama] Embedding failed: HTTP ${res.status}`);
            return null;
        }
        const data = await res.json();
        if (!data.embedding || data.embedding.length === 0) {
            v2_1.logger.warn('[Ollama] Embedding response empty');
            return null;
        }
        v2_1.logger.info(`[Ollama] ✅ embedding dim=${data.embedding.length}`);
        return data.embedding;
    }
    catch (err) {
        v2_1.logger.warn('[Ollama] Embedding error:', err.message);
        return null;
    }
    finally {
        clearTimeout(timeout);
    }
}
//# sourceMappingURL=local-inference.service.js.map