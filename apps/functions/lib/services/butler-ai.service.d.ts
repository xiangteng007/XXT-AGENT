/**
 * Butler AI Service
 *
 * Provides intelligent response generation for the Personal Butler
 * using Gemini AI or OpenAI GPT with fallback to keyword matching.
 */
export type AIModel = 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gpt-4o' | 'gpt-4o-mini';
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
 */
export declare function generateAIResponse(userMessage: string, userId?: string, context?: {
    previousMessages?: string[];
    userProfile?: Record<string, unknown>;
    model?: AIModel;
    activeAgent?: string;
}): Promise<string>;
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
 */
export declare function generateAIResponseWithTools(userMessage: string, userId: string, contextPrompt: string, activeAgent?: string): Promise<{
    text: string;
    toolCalls?: Array<{
        name: string;
        args: Record<string, unknown>;
    }>;
}>;
//# sourceMappingURL=butler-ai.service.d.ts.map