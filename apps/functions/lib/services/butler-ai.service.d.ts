/**
 * Butler AI Service
 *
 * Provides intelligent response generation for the Personal Butler
 * using Gemini AI or OpenAI GPT with fallback to keyword matching.
 */
export type AIModel = 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gpt-4o' | 'gpt-4o-mini';
/**
 * Generate AI response for user message
 */
export declare function generateAIResponse(userMessage: string, userId?: string, context?: {
    previousMessages?: string[];
    userProfile?: Record<string, unknown>;
    model?: AIModel;
}): Promise<string>;
/**
 * Check if AI service is available
 */
export declare function isAIAvailable(model?: AIModel): Promise<boolean>;
/**
 * Get available AI models
 */
export declare function getAvailableModels(): AIModel[];
//# sourceMappingURL=butler-ai.service.d.ts.map