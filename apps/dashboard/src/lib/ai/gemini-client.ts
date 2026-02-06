/**
 * AI Client for Dashboard
 * 
 * Calls the secure ai-gateway backend instead of directly using Gemini API key.
 * This ensures API keys are never exposed to the frontend.
 */

// Backend AI Gateway URL
const AI_GATEWAY_URL = process.env.NEXT_PUBLIC_AI_GATEWAY_URL || 'http://localhost:8080';

/**
 * AI Client configuration
 */
interface AIClientConfig {
    baseUrl?: string;
    timeout?: number;
    model?: string;
}

let config: AIClientConfig = {
    baseUrl: AI_GATEWAY_URL,
    timeout: 30000,
    model: 'gemini-1.5-flash'
};

/**
 * Configure the AI client
 */
export function configureAIClient(options: AIClientConfig): void {
    config = { ...config, ...options };
}

/**
 * Set the active model
 */
export function setActiveModel(modelId: string): void {
    config.model = modelId;
}

/**
 * Get the current model
 */
export function getActiveModel(): string {
    return config.model || 'gemini-1.5-flash';
}

/**
 * Model info from backend
 */
export interface AIModelInfo {
    id: string;
    name: string;
    description: string;
    tier: 'latest' | 'premium' | 'standard' | 'economy';
    isDefault: boolean;
}

/**
 * Default available models (fallback when backend is unavailable)
 */
const DEFAULT_MODELS: AIModelInfo[] = [
    {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: '快速、經濟的選擇，適合日常對話',
        tier: 'economy',
        isDefault: true
    },
    {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: '更強推理能力，支持長上下文',
        tier: 'premium',
        isDefault: false
    },
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'OpenAI 最強模型，優秀的推理和創意能力',
        tier: 'latest',
        isDefault: false
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'GPT-4o 的經濟版本，性價比最佳',
        tier: 'standard',
        isDefault: false
    }
];

/**
 * Get available models from backend (with fallback)
 */
export async function getAvailableModels(): Promise<AIModelInfo[]> {
    // In production without AI Gateway configured, silently use defaults
    const gatewayUrl = config.baseUrl || '';
    const isLocalhost = gatewayUrl.includes('localhost') || gatewayUrl.includes('127.0.0.1');
    const isProduction = typeof window !== 'undefined' && 
        window.location.hostname !== 'localhost';
    
    // Skip network request in production when using localhost fallback
    if (isProduction && isLocalhost) {
        return DEFAULT_MODELS;
    }
    
    try {
        const response = await fetch(`${config.baseUrl}/ai/models`);
        if (!response.ok) {
            console.warn('Backend AI models unavailable, using defaults');
            return DEFAULT_MODELS;
        }
        const data = await response.json();
        const models = data.models || [];
        // If backend returns empty or only Gemini, merge with GPT models
        if (models.length === 0) {
            return DEFAULT_MODELS;
        }
        // Check if GPT models are missing and add them
        const hasGPT = models.some((m: AIModelInfo) => m.id.startsWith('gpt'));
        if (!hasGPT) {
            const gptModels = DEFAULT_MODELS.filter(m => m.id.startsWith('gpt'));
            return [...models, ...gptModels];
        }
        return models;
    } catch (error) {
        // Only log in development
        if (!isProduction) {
            console.error('Failed to fetch models, using defaults:', error);
        }
        return DEFAULT_MODELS;
    }
}


/**
 * Make authenticated request to AI Gateway
 */
async function aiRequest<T>(
    endpoint: string,
    body: Record<string, unknown>
): Promise<T> {
    // Check if we're in production without a real AI Gateway
    const gatewayUrl = config.baseUrl || '';
    const isLocalhost = gatewayUrl.includes('localhost') || gatewayUrl.includes('127.0.0.1');
    const isProduction = typeof window !== 'undefined' && 
        window.location.hostname !== 'localhost';
    
    if (isProduction && isLocalhost) {
        throw new Error('AI Gateway 未配置。請聯繫管理員設定 NEXT_PUBLIC_AI_GATEWAY_URL 環境變數。');
    }

    const url = `${config.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...body, model: config.model }),
            signal: controller.signal,
            credentials: 'include'
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `AI request failed: ${response.status}`);
        }

        return response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('AI request timed out');
        }
        throw error;
    }
}

// ============ Exported Functions ============

/**
 * Initialize AI client (compatibility function, no-op in new architecture)
 */
export function initializeGemini(_apiKey?: string): boolean {
    // Backend handles initialization - no direct API key usage
    return true;
}

/**
 * Check if AI is available
 */
export async function checkAIHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${config.baseUrl}/health`);
        const data = await response.json();
        return data.status === 'healthy' && data.geminiReady === true;
    } catch {
        return false;
    }
}

/**
 * Basic text generation (via summarize endpoint)
 */
export async function generateText(prompt: string): Promise<string> {
    const result = await aiRequest<{ summary: string }>('/ai/summarize', {
        text: prompt,
        maxLength: 500
    });
    return result.summary;
}

/**
 * Generate JSON output
 */
export async function generateJSON<T>(prompt: string): Promise<T> {
    // Use chat endpoint with JSON instruction
    const result = await aiRequest<{ reply: string }>('/ai/chat', {
        message: prompt,
        systemPrompt: '你是一個 JSON 生成器。請只回應有效的 JSON，不要包含任何其他文字或 markdown 標記。'
    });

    // Parse JSON from response
    const cleanJson = result.reply
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

    return JSON.parse(cleanJson) as T;
}

/**
 * Text summarization
 */
export async function summarizeText(
    text: string,
    options: { maxLength?: number; language?: string } = {}
): Promise<string> {
    const result = await aiRequest<{ summary: string }>('/ai/summarize', {
        text,
        maxLength: options.maxLength || 200,
        language: options.language || 'zh-TW'
    });
    return result.summary;
}

/**
 * Sentiment analysis
 */
export interface SentimentResult {
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
    score: number;
    confidence: number;
    emotions?: {
        joy: number;
        anger: number;
        fear: number;
        sadness: number;
        surprise: number;
    };
    keywords?: string[];
}

export async function analyzeSentiment(
    text: string,
    context?: string
): Promise<SentimentResult> {
    return aiRequest<SentimentResult>('/ai/sentiment', { text, context });
}

/**
 * Batch sentiment analysis
 */
export async function analyzeSentimentBatch(
    items: Array<{ id: string; content: string }>
): Promise<Map<string, 'positive' | 'negative' | 'neutral' | 'mixed'>> {
    const result = await aiRequest<{
        results: Array<{ id: string; label: string }>
    }>('/ai/batch-sentiment', { items });

    const map = new Map<string, 'positive' | 'negative' | 'neutral' | 'mixed'>();
    for (const item of result.results) {
        map.set(item.id, item.label as 'positive' | 'negative' | 'neutral' | 'mixed');
    }
    return map;
}

/**
 * Impact assessment
 */
export interface ImpactResult {
    severity: number;
    confidence: number;
    direction: 'bullish' | 'bearish' | 'neutral' | 'mixed';
    timeframe: 'immediate' | 'short_term' | 'long_term';
    affectedSectors: string[];
    affectedSymbols: string[];
    explanation: string;
    scores: {
        market: number;
        news: number;
        social: number;
    };
}

export async function assessImpact(
    title: string,
    options: {
        content?: string;
        symbols?: string[];
        newsType?: string;
    } = {}
): Promise<ImpactResult> {
    return aiRequest<ImpactResult>('/ai/impact', {
        title,
        content: options.content,
        symbols: options.symbols || [],
        newsType: options.newsType
    });
}

/**
 * Chat/Q&A
 */
export async function chat(
    message: string,
    options: { context?: string; systemPrompt?: string } = {}
): Promise<string> {
    const result = await aiRequest<{ reply: string }>('/ai/chat', {
        message,
        context: options.context,
        systemPrompt: options.systemPrompt
    });
    return result.reply;
}

/**
 * Streaming text generation (simulated via regular request)
 * Note: True streaming would require WebSocket or SSE
 */
export async function* streamText(prompt: string): AsyncGenerator<string> {
    const result = await chat(prompt);

    // Simulate streaming by yielding chunks
    const chunkSize = 20;
    for (let i = 0; i < result.length; i += chunkSize) {
        yield result.slice(i, i + chunkSize);
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

// ============ Legacy Compatibility ============

/**
 * Get Gemini model (legacy compatibility - returns null)
 * @deprecated Use the new API functions instead
 */
export function getGeminiModel(): null {
    console.warn('getGeminiModel() is deprecated. Use the new API functions instead.');
    return null;
}
