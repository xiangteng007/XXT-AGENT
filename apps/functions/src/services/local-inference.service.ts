/**
 * Local Inference Service
 *
 * Wraps the Ollama HTTP API running on the local RTX 4080 desktop.
 * Firebase Functions connects via Tailscale Funnel or a configurable OLLAMA_BASE_URL.
 *
 * Installed models (confirmed 2026-04-22):
 *   - gpt-oss:20b    → 20.9B MXFP4, primary reasoning model
 *   - qwen3:14b      → 14.8B Q4_K_M, Traditional Chinese conversations
 *   - nomic-embed-text → 137M F16, text embeddings for ChromaDB
 *
 * Connection strategy:
 *   1. Read OLLAMA_BASE_URL from Firebase Secret / env
 *   2. Health check before each call
 *   3. 60s timeout (14b models need more time); caller catches OllamaUnavailableError
 */

import { logger } from 'firebase-functions/v2';

// ================================
// Types
// ================================

export type OllamaModel =
    | 'gpt-oss:20b'
    | 'qwen3:14b'
    | 'nomic-embed-text'
    | 'nomic-embed-text:latest';

export interface OllamaMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OllamaGenerateRequest {
    model: OllamaModel;
    prompt: string;
    system?: string;
    stream: false;
    options?: {
        temperature?: number;
        num_predict?: number; // max tokens to generate
        top_p?: number;
        repeat_penalty?: number;
    };
}

export interface OllamaChatRequest {
    model: OllamaModel;
    messages: OllamaMessage[];
    stream: false;
    options?: {
        temperature?: number;
        num_predict?: number;
    };
}

export interface OllamaResponse {
    model: string;
    response?: string;        // /api/generate
    message?: { role: string; content: string }; // /api/chat
    done: boolean;
    total_duration?: number;  // nanoseconds
    eval_count?: number;      // tokens generated
}

export class OllamaUnavailableError extends Error {
    constructor(reason: string) {
        super(`Ollama unavailable: ${reason}`);
        this.name = 'OllamaUnavailableError';
    }
}

// ================================
// Configuration
// ================================

/** Default: Tailscale Funnel URL or direct LAN address.
 *  Set OLLAMA_BASE_URL in Firebase Secret Manager or .env.
 *  Examples:
 *    - https://your-machine.tailnet-xxx.ts.net (Tailscale Funnel)
 *    - http://192.168.1.100:11434             (LAN direct)
 *    - http://localhost:11434                  (local emulator)
 */
function getOllamaBaseUrl(): string {
    return (
        process.env.OLLAMA_BASE_URL ||
        'http://localhost:11434' // fallback for local emulator testing
    );
}

const OLLAMA_TIMEOUT_MS = 90_000;   // 90s – gpt-oss:20b / qwen3:14b on RTX 4080 SUPER
const HEALTH_TIMEOUT_MS = 8_000;    // 8s  – Tailscale round-trip can be 3-6s from Cloud Run Asia

// ================================
// Health Check
// ================================

let _lastHealthCheck = 0;
let _lastHealthResult = false;
const HEALTH_CACHE_MS = 60_000; // cache health result for 60s

/**
 * Check if Ollama is reachable.
 * Result is cached for 60s to avoid repeated HEAD requests on every inference call.
 */
export async function isOllamaAvailable(): Promise<boolean> {
    const now = Date.now();
    if (now - _lastHealthCheck < HEALTH_CACHE_MS) {
        return _lastHealthResult;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
        const res = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timeout);
        _lastHealthResult = res.ok;
    } catch {
        _lastHealthResult = false;
    }

    _lastHealthCheck = now;
    logger.info(`[Ollama] Health check: ${_lastHealthResult ? '✅ online' : '❌ offline'}`);
    return _lastHealthResult;
}

/**
 * Invalidate health cache (call after a failed inference to retry health next time)
 */
export function invalidateOllamaHealthCache(): void {
    _lastHealthCheck = 0;
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
export function selectLocalModel(agentId: string): OllamaModel {
    switch (agentId) {
        case 'investment':
        case 'accountant':
        case 'tax':
        case 'nexus':
            return 'gpt-oss:20b';   // heavier reasoning for financial / analytical tasks
        case 'butler':
        case 'titan':
        case 'lumi':
        case 'rusty':
        default:
            return 'qwen3:14b';    // Traditional Chinese specialist for daily interactions
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
export async function ollamaChat(
    messages: OllamaMessage[],
    model: OllamaModel = 'qwen3:14b',
    options?: OllamaChatRequest['options']
): Promise<string> {
    const available = await isOllamaAvailable();
    if (!available) {
        throw new OllamaUnavailableError('health check failed');
    }

    const body: OllamaChatRequest = {
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

        const data = (await res.json()) as OllamaResponse;
        const text = data.message?.content || data.response || '';

        const tokensGenerated = data.eval_count ?? 0;
        const durationMs = data.total_duration ? Math.round(data.total_duration / 1_000_000) : 0;
        logger.info(`[Ollama] ✅ model=${model} tokens=${tokensGenerated} time=${durationMs}ms`);

        return text.trim();
    } catch (err) {
        if ((err as Error).name === 'AbortError') {
            throw new OllamaUnavailableError('timeout after 60s');
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Single-turn generate (simpler, no history needed).
 * Used for summarization tasks like /reflect.
 *
 * @throws OllamaUnavailableError if Ollama is offline or times out
 */
export async function ollamaGenerate(
    prompt: string,
    systemPrompt?: string,
    model: OllamaModel = 'qwen3:14b',
    options?: OllamaGenerateRequest['options']
): Promise<string> {
    const available = await isOllamaAvailable();
    if (!available) {
        throw new OllamaUnavailableError('health check failed');
    }

    const body: OllamaGenerateRequest = {
        model,
        prompt,
        system: systemPrompt,
        stream: false,
        options: {
            temperature: 0.5,   // lower temp for summarization
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

        const data = (await res.json()) as OllamaResponse;
        const text = data.response || '';

        logger.info(`[Ollama] ✅ generate model=${model} done=${data.done}`);
        return text.trim();
    } catch (err) {
        if ((err as Error).name === 'AbortError') {
            throw new OllamaUnavailableError('timeout after 30s');
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Get list of models available on this Ollama instance.
 * Used by /memory command to display available local models.
 */
export async function getAvailableModels(): Promise<string[]> {
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
        const res = await fetch(`${getOllamaBaseUrl()}/api/tags`, { signal: controller.signal });
        if (!res.ok) return [];
        const data = await res.json() as { models?: Array<{ name: string }> };
        return (data.models || []).map(m => m.name);
    } catch {
        return [];
    }
}
