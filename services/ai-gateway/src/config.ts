/**
 * AI Gateway Configuration
 *
 * Centralized model registry and provider configuration.
 * Updated: 2026-03-27 to reflect latest model releases.
 */

export const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'xxt-agent';
export const DEFAULT_MODEL = 'gemini-2.5-flash-preview-05-20';

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
export const SUPPORTED_MODELS: Record<string, ModelInfo> = {
    // ══════════════════════════════════════════════
    // Google Gemini 3.1 (2026 Q1 Latest)
    // ══════════════════════════════════════════════
    'gemini-3.1-pro': {
        name: 'Gemini 3.1 Pro',
        description: '最新旗艦推理模型，2M token 上下文，多模態 benchmark 領先',
        tier: 'premium',
        provider: 'google',
        contextWindow: '2M tokens',
    },
    'gemini-3.1-flash-lite': {
        name: 'Gemini 3.1 Flash-Lite',
        description: '超高速低成本模型，適合大量批次分析',
        tier: 'economy',
        provider: 'google',
        contextWindow: '1M tokens',
    },

    // ══════════════════════════════════════════════
    // Google Gemini 2.5
    // ══════════════════════════════════════════════
    'gemini-2.5-pro-preview-06-05': {
        name: 'Gemini 2.5 Pro',
        description: '強力推理與多模態能力，適合深度分析',
        tier: 'premium',
        provider: 'google',
        contextWindow: '1M tokens',
    },
    'gemini-2.5-flash-preview-05-20': {
        name: 'Gemini 2.5 Flash',
        description: '平衡速度與智能的快速模型',
        tier: 'latest',
        provider: 'google',
        contextWindow: '1M tokens',
    },

    // ══════════════════════════════════════════════
    // Google Gemini 2.0
    // ══════════════════════════════════════════════
    'gemini-2.0-flash': {
        name: 'Gemini 2.0 Flash',
        description: '穩定版快速模型，推理與多模態能力',
        tier: 'standard',
        provider: 'google',
        contextWindow: '1M tokens',
    },
    'gemini-2.0-flash-lite': {
        name: 'Gemini 2.0 Flash-Lite',
        description: '超低延遲輕量模型，適合高頻即時互動',
        tier: 'economy',
        provider: 'google',
    },

    // ══════════════════════════════════════════════
    // Google Gemini 1.5 (Legacy — 逐步淘汰)
    // ══════════════════════════════════════════════
    'gemini-1.5-pro': {
        name: 'Gemini 1.5 Pro',
        description: '100萬 token 上下文（Legacy，建議遷移至 2.5+）',
        tier: 'standard',
        provider: 'google',
        deprecated: true,
    },
    'gemini-1.5-flash': {
        name: 'Gemini 1.5 Flash',
        description: '快速回應、低成本（Legacy，建議遷移至 2.0+）',
        tier: 'economy',
        provider: 'google',
        deprecated: true,
    },

    // ══════════════════════════════════════════════
    // OpenAI GPT-5.x (2026 Latest)
    // ══════════════════════════════════════════════
    'gpt-5.4': {
        name: 'GPT-5.4',
        description: 'OpenAI 最新旗艦模型，Tool Search 支援，頂級推理',
        tier: 'premium',
        provider: 'openai',
        contextWindow: '1.05M tokens',
    },
    'o4-mini': {
        name: 'o4-mini',
        description: 'OpenAI 推理專用模型，深度思考與分析',
        tier: 'latest',
        provider: 'openai',
    },
    'gpt-4o': {
        name: 'GPT-4o',
        description: 'OpenAI 多模態模型，推理與創意兼備',
        tier: 'standard',
        provider: 'openai',
    },
    'gpt-4o-mini': {
        name: 'GPT-4o Mini',
        description: 'OpenAI 高性價比模型，適合日常任務',
        tier: 'economy',
        provider: 'openai',
    },

    // ══════════════════════════════════════════════
    // Anthropic Claude 4.x (2026 Latest)
    // ══════════════════════════════════════════════
    'claude-opus-4-20250514': {
        name: 'Claude Opus 4.6',
        description: 'Anthropic 頂級旗艦，1M token 上下文，頂級推理與代碼能力',
        tier: 'premium',
        provider: 'anthropic',
        contextWindow: '1M tokens',
    },
    'claude-sonnet-4-20250514': {
        name: 'Claude Sonnet 4.6',
        description: 'Anthropic 性能/成本最優，優秀的指令遵循與分析能力',
        tier: 'latest',
        provider: 'anthropic',
        contextWindow: '200K tokens',
    },
    'claude-haiku-3-5-20241022': {
        name: 'Claude Haiku 3.5',
        description: 'Anthropic 快速模型，低成本高效率',
        tier: 'economy',
        provider: 'anthropic',
    },
};

/**
 * Get all models for a specific provider
 */
export function getModelsByProvider(provider: string): Record<string, ModelInfo> {
    return Object.fromEntries(
        Object.entries(SUPPORTED_MODELS).filter(([, info]) => info.provider === provider)
    );
}

/**
 * Get all non-deprecated models
 */
export function getActiveModels(): Record<string, ModelInfo> {
    return Object.fromEntries(
        Object.entries(SUPPORTED_MODELS).filter(([, info]) => !info.deprecated)
    );
}
