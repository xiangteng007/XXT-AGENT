/**
 * OpenAI Provider
 *
 * Handles OpenAI API interactions (GPT-5.x, o4-mini, GPT-4o).
 */
export declare function initialize(): Promise<boolean>;
export declare function isReady(): boolean;
export declare function generateText(prompt: string, modelId: string): Promise<string>;
