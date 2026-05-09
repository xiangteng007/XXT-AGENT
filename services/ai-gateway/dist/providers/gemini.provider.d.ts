/**
 * Gemini Provider
 *
 * Handles Google Generative AI API interactions.
 */
export declare function initialize(): Promise<boolean>;
export declare function isReady(): boolean;
export declare function generateText(prompt: string, modelId: string): Promise<string>;
