/**
 * Provider Manager
 *
 * Unified interface for initializing and routing to AI providers.
 */
/**
 * Provider readiness state — exposed for health checks
 */
export declare function getProviderStatus(): Record<string, boolean>;
/**
 * Initialize all AI providers (idempotent)
 */
export declare function initializeProviders(): Promise<void>;
/**
 * Unified text generation — routes to correct provider based on model ID
 */
export declare function generateText(prompt: string, modelId?: string): Promise<string>;
