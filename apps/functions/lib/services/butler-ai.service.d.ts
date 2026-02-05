/**
 * Butler AI Service
 *
 * Provides intelligent response generation for the Personal Butler
 * using Gemini AI with fallback to keyword matching.
 */
/**
 * Generate AI response for user message
 */
export declare function generateAIResponse(userMessage: string, userId?: string, context?: {
    previousMessages?: string[];
    userProfile?: Record<string, unknown>;
}): Promise<string>;
/**
 * Check if AI service is available
 */
export declare function isAIAvailable(): Promise<boolean>;
//# sourceMappingURL=butler-ai.service.d.ts.map