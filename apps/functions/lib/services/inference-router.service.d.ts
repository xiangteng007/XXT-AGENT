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
import type { StreamChunk } from './local-inference.service';
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
/**
 * Classify a user message to determine the best inference backend.
 */
export declare function classifyTask(message: string, agentId?: string): RoutingDecision;
/**
 * Route a chat message through local Ollama first, fallback to cloud callback.
 *
 * @param message      User message
 * @param agentId      Active agent (determines model + system prompt)
 * @param history      Previous conversation messages (last N turns)
 * @param cloudFallback  Async function to call Gemini/OpenAI when local fails
 */
export declare function routedChat(message: string, agentId: string, history: string[], cloudFallback: () => Promise<string>): Promise<LocalInferenceResult>;
/**
 * Streaming version of routedChat — yields progressive StreamChunks.
 *
 * If local Ollama is available, streams tokens in real-time.
 * If cloud fallback is needed, yields a single final chunk (no streaming).
 */
export declare function routedChatStream(message: string, agentId: string, history: string[], cloudFallback: () => Promise<string>): AsyncGenerator<StreamChunk & {
    backend: string;
    model: string;
}>;
/**
 * Route a summarization task (used by /reflect).
 * Almost always runs locally — summarization is pure computation.
 */
export declare function routedSummarize(content: string, systemInstruction: string, cloudFallback: () => Promise<string>): Promise<LocalInferenceResult>;
/**
 * Route a multi-agent discussion turn.
 * Each agent calls this independently; local model handles most turns.
 */
export declare function routedAgentTurn(agentId: string, topic: string, systemPrompt: string, cloudFallback: () => Promise<string>): Promise<LocalInferenceResult>;
//# sourceMappingURL=inference-router.service.d.ts.map