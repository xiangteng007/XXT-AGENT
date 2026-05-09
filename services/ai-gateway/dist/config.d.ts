/**
 * AI Gateway Configuration
 *
 * Centralized model registry and provider configuration.
 * Updated: 2026-03-27 to reflect latest model releases.
 */
export declare const PROJECT_ID: string;
export declare const DEFAULT_MODEL = "gemini-2.5-flash-preview-05-20";
export interface ModelInfo {
    name: string;
    description: string;
    tier: 'premium' | 'latest' | 'standard' | 'economy';
    provider: 'google' | 'openai' | 'anthropic';
    contextWindow?: string;
    deprecated?: boolean;
}
/**
 * Supported Models Registry — Multi-provider
 *
 * Updated 2026-03-27 to include:
 * - Gemini 3.1 Pro / Flash-Lite
 * - Claude Opus 4.6 / Sonnet 4.6
 * - GPT-5.4 / o4-mini
 */
export declare const SUPPORTED_MODELS: Record<string, ModelInfo>;
/**
 * Get all models for a specific provider
 */
export declare function getModelsByProvider(provider: string): Record<string, ModelInfo>;
/**
 * Get all non-deprecated models
 */
export declare function getActiveModels(): Record<string, ModelInfo>;
