/**
 * Butler AI Service
 *
 * Provides intelligent response generation for the Personal Butler
 * using Gemini AI or OpenAI GPT with fallback to keyword matching.
 */
export type AIModel = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gpt-4o' | 'gpt-4o-mini';
/**
 * Pre-warm AI clients to reduce cold start latency (V3 #25)
 * Call from health endpoint or global init to eagerly initialize.
 */
export declare function preWarmAIClients(): Promise<{
    gemini: boolean;
    openai: boolean;
}>;
export declare function getAgentPrompt(agentId?: string): string;
/**
 * Generate AI response for user message
 *
 * Routing strategy (Local-First):
 *   1. Classify task → local-safe vs cloud-required
 *   2. Local-safe  → Ollama on RTX 4080 (zero token cost)
 *   3. Cloud-required or Ollama offline → Gemini / OpenAI (fallback)
 */
export declare function generateAIResponse(userMessage: string, userId?: string, context?: {
    previousMessages?: string[];
    userProfile?: Record<string, unknown>;
    model?: AIModel;
    activeAgent?: string;
}): Promise<string>;
/**
 * Streaming version of generateAIResponse — yields progressive text chunks.
 *
 * For Telegram: caller sends initial "⏳ 思考中..." message, then
 * edits it every ~50 tokens with the accumulated text so far.
 *
 * Yields: { text: string, done: boolean, backend: string, model: string }
 */
export declare function generateStreamingResponse(userMessage: string, userId?: string, context?: {
    previousMessages?: string[];
    activeAgent?: string;
}): AsyncGenerator<{
    text: string;
    done: boolean;
    backend: string;
    model: string;
}>;
/**
 * Check if AI service is available
 */
export declare function isAIAvailable(model?: AIModel): Promise<boolean>;
/**
 * Get available AI models
 */
export declare function getAvailableModels(): AIModel[];
/**
 * Generate AI response with function calling capability.
 * The AI can autonomously trigger tool calls to perform actions.
 *
 * ## Routing (V3 Privacy-First)
 *
 * Step 1 – Local Tool Parser (Ollama / RTX 4080):
 *   Parses user intent into a structured JSON tool call — no cloud API involved.
 *   Covers all sensitive tools: record_expense, add_event, record_weight,
 *   record_fuel, add_investment, get_schedule, get_spending, get_portfolio,
 *   calculate_loan, estimate_tax, record_exercise, record_sleep.
 *
 *   If Ollama is OFFLINE:
 *     → Returns a privacy-safe offline message.
 *     → Does NOT fall back to cloud for sensitive data.
 *
 * Step 2 – Regular conversation (routedChat):
 *   If no tool intent detected, use routedChat (Ollama → Gemini fallback)
 *   for natural conversation.
 *
 * Step 3 – Gemini Function Calling (cloud, limited scope):
 *   Only for: get_financial_advice (synthesized multi-domain AI analysis).
 *   This tool does NOT transmit raw PII; it reads aggregated data from
 *   Firestore summaries that were already stored locally.
 */
export declare function generateAIResponseWithTools(userMessage: string, userId: string, contextPrompt: string, activeAgent?: string): Promise<{
    text: string;
    toolCalls?: Array<{
        name: string;
        args: Record<string, unknown>;
    }>;
}>;
//# sourceMappingURL=butler-ai.service.d.ts.map