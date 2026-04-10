/**
 * Provider Manager
 *
 * Unified interface for initializing and routing to AI providers.
 */

import * as gemini from './gemini.provider';
import * as openai from './openai.provider';
import * as anthropic from './anthropic.provider';
import { SUPPORTED_MODELS, DEFAULT_MODEL } from '../config';

let isInitialized = false;

/**
 * Provider readiness state — exposed for health checks
 */
export function getProviderStatus(): Record<string, boolean> {
    return {
        google: gemini.isReady(),
        openai: openai.isReady(),
        anthropic: anthropic.isReady(),
    };
}

/**
 * Initialize all AI providers (idempotent)
 */
export async function initializeProviders(): Promise<void> {
    if (isInitialized) return;

    await Promise.allSettled([
        gemini.initialize(),
        openai.initialize(),
        anthropic.initialize(),
    ]);

    isInitialized = true;
}

/**
 * Unified text generation — routes to correct provider based on model ID
 */
export async function generateText(prompt: string, modelId: string = DEFAULT_MODEL): Promise<string> {
    const model = SUPPORTED_MODELS[modelId];
    const provider = model?.provider || 'google';
    const resolvedModelId = model ? modelId : DEFAULT_MODEL;

    switch (provider) {
        case 'openai':
            return openai.generateText(prompt, resolvedModelId);
        case 'anthropic':
            return anthropic.generateText(prompt, resolvedModelId);
        case 'google':
        default:
            return gemini.generateText(prompt, resolvedModelId);
    }
}
