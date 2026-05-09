/**
 * Anthropic Provider
 *
 * Handles Anthropic API interactions (Claude Opus 4.6, Sonnet 4.6, Haiku 3.5).
 */
export declare function initialize(): Promise<boolean>;
export declare function isReady(): boolean;
export declare function generateText(prompt: string, modelId: string): Promise<string>;
