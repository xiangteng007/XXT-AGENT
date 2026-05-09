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
export type OllamaModel = 'gpt-oss:20b' | 'qwen3:14b' | 'nomic-embed-text';
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
        num_predict?: number;
        top_p?: number;
        repeat_penalty?: number;
    };
}
export interface OllamaChatRequest {
    model: OllamaModel;
    messages: OllamaMessage[];
    stream: boolean;
    options?: {
        temperature?: number;
        num_predict?: number;
    };
}
/** Chunk emitted by ollamaChatStream */
export interface StreamChunk {
    text: string;
    delta: string;
    done: boolean;
    tokenCount?: number;
}
export interface OllamaResponse {
    model: string;
    response?: string;
    message?: {
        role: string;
        content: string;
    };
    done: boolean;
    total_duration?: number;
    eval_count?: number;
}
export declare class OllamaUnavailableError extends Error {
    constructor(reason: string);
}
/**
 * Check if Ollama is reachable.
 * Result is cached for 30s to avoid repeated requests on every inference call.
 */
export declare function isOllamaAvailable(): Promise<boolean>;
/**
 * Invalidate health cache (call after a failed inference to retry health next time)
 */
export declare function invalidateOllamaHealthCache(): void;
/**
 * Pre-warm a model into VRAM by sending a minimal generate request.
 * Call during Cloud Run startup to avoid first-request model loading delay (~10s).
 * Non-blocking: failures are silently ignored.
 */
export declare function preWarmModel(model?: OllamaModel): Promise<boolean>;
/**
 * Choose the best local model for a given agent.
 *
 * Installed on RTX 4080 SUPER (confirmed 2026-04-22):
 *   gpt-oss:20b   — 20.9B MXFP4, strong reasoning + English/Chinese
 *   qwen3:14b     — 14.8B Q4_K_M, Traditional Chinese specialist
 */
export declare function selectLocalModel(agentId: string): OllamaModel;
/**
 * Chat-style inference with message history.
 * Preferred over generate() for multi-turn conversations.
 *
 * @throws OllamaUnavailableError if Ollama is offline or times out
 */
export declare function ollamaChat(messages: OllamaMessage[], model?: OllamaModel, options?: OllamaChatRequest['options']): Promise<string>;
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
export declare function ollamaChatStream(messages: OllamaMessage[], model?: OllamaModel, options?: OllamaChatRequest['options']): AsyncGenerator<StreamChunk>;
/**
 * Single-turn generate (simpler, no history needed).
 * Used for summarization tasks like /reflect.
 *
 * @throws OllamaUnavailableError if Ollama is offline or times out
 */
export declare function ollamaGenerate(prompt: string, systemPrompt?: string, model?: OllamaModel, options?: OllamaGenerateRequest['options']): Promise<string>;
/**
 * Get list of models available on this Ollama instance.
 * Used by /memory command to display available local models.
 */
export declare function getAvailableModels(): Promise<string[]>;
/**
 * Generate text embedding via local Ollama nomic-embed-text model.
 * Used for ChromaDB vector similarity search — all computation stays local.
 *
 * @returns Float array embedding, or null if Ollama is unavailable
 */
export declare function embedText(text: string): Promise<number[] | null>;
//# sourceMappingURL=local-inference.service.d.ts.map