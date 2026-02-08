/**
 * AI Gateway Service
 * 
 * Multi-provider AI gateway supporting Gemini, OpenAI GPT, and Anthropic Claude.
 * - Loads API keys from Secret Manager (not exposed to frontend)
 * - Provides unified REST endpoints for AI operations
 * - Rate limiting and request validation
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const PORT = process.env.PORT || 8080;
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'xxt-agent';
const SECRET_ID = process.env.GEMINI_SECRET_ID || 'gemini-api-key';
const DEFAULT_MODEL = 'gemini-2.0-flash';

// Supported Models - Multi-provider (Gemini + OpenAI + Anthropic)
const SUPPORTED_MODELS: Record<string, { name: string; description: string; tier: string; provider: string }> = {
    // === Google Gemini ===
    'gemini-2.0-flash': {
        name: 'Gemini 2.0 Flash',
        description: '最新一代 AI 模型，更強的推理與多模態能力（預設）',
        tier: 'latest',
        provider: 'google',
    },
    'gemini-2.0-flash-lite': {
        name: 'Gemini 2.0 Flash-Lite',
        description: '超低延遲輕量模型，適合高頻即時互動',
        tier: 'economy',
        provider: 'google',
    },
    'gemini-2.0-pro-exp-02-05': {
        name: 'Gemini 2.0 Pro (實驗)',
        description: '最強推理能力，適合複雜金融分析與研究',
        tier: 'premium',
        provider: 'google',
    },
    'gemini-2.0-flash-thinking-exp-01-21': {
        name: 'Gemini 2.0 Flash Thinking',
        description: '深度思考模型，適合多步驟推理與策略規劃',
        tier: 'premium',
        provider: 'google',
    },
    'gemini-1.5-pro': {
        name: 'Gemini 1.5 Pro',
        description: '100萬 token 上下文，適合長文檔分析',
        tier: 'standard',
        provider: 'google',
    },
    'gemini-1.5-flash': {
        name: 'Gemini 1.5 Flash',
        description: '快速回應、低成本，適合日常任務',
        tier: 'standard',
        provider: 'google',
    },
    'gemini-1.5-flash-8b': {
        name: 'Gemini 1.5 Flash-8B',
        description: '超低成本，適合大量批次處理',
        tier: 'economy',
        provider: 'google',
    },
    // === OpenAI GPT ===
    'gpt-4o': {
        name: 'GPT-4o',
        description: 'OpenAI 最強多模態模型，推理與創意兼備',
        tier: 'premium',
        provider: 'openai',
    },
    'gpt-4o-mini': {
        name: 'GPT-4o Mini',
        description: 'OpenAI 高性價比模型，適合日常任務',
        tier: 'standard',
        provider: 'openai',
    },
    // === Anthropic Claude ===
    'claude-sonnet-4-20250514': {
        name: 'Claude Sonnet 4',
        description: 'Anthropic 最新模型，優秀的指令遵循與分析能力',
        tier: 'premium',
        provider: 'anthropic',
    },
    'claude-haiku-3-5-20241022': {
        name: 'Claude Haiku 3.5',
        description: 'Anthropic 快速模型，低成本高效率',
        tier: 'standard',
        provider: 'anthropic',
    },
};

// Provider state
let genAI: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let isInitialized = false;
const modelCache = new Map<string, GenerativeModel>();

// Provider readiness flags
const providerReady: Record<string, boolean> = {
    google: false,
    openai: false,
    anthropic: false,
};

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://xxt-agent-dashboard.vercel.app',
        /\.vercel\.app$/
    ],
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Rate limiting: 30 requests per minute per IP
app.use('/ai/', rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '請求過於頻繁，請稍後再試' }
}));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(JSON.stringify({
        severity: 'INFO',
        message: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
    }));
    next();
});

/**
 * Load API key from env or Secret Manager
 */
async function loadSecret(envKey: string, secretId?: string): Promise<string | null> {
    if (process.env[envKey]) {
        return process.env[envKey]!;
    }

    if (!secretId) return null;

    try {
        const client = new SecretManagerServiceClient();
        const name = `projects/${PROJECT_ID}/secrets/${secretId}/versions/latest`;
        const [response] = await client.accessSecretVersion({ name });
        const payload = response.payload?.data;
        if (!payload) return null;
        return typeof payload === 'string' ? payload : new TextDecoder('utf-8').decode(payload as Uint8Array);
    } catch (error) {
        console.log(JSON.stringify({ severity: 'WARNING', message: `Secret ${secretId} not available`, error: String(error) }));
        return null;
    }
}

/**
 * Initialize all AI providers
 */
async function initializeProviders(): Promise<void> {
    if (isInitialized) return;

    // Google Gemini
    try {
        const geminiKey = await loadSecret('GEMINI_API_KEY', SECRET_ID);
        if (geminiKey) {
            genAI = new GoogleGenerativeAI(geminiKey);
            providerReady.google = true;
            console.log(JSON.stringify({ severity: 'INFO', message: 'Gemini initialized' }));
        }
    } catch (e) {
        console.error(JSON.stringify({ severity: 'ERROR', message: 'Gemini init failed', error: String(e) }));
    }

    // OpenAI
    try {
        const openaiKey = await loadSecret('OPENAI_API_KEY', 'openai-api-key');
        if (openaiKey) {
            openaiClient = new OpenAI({ apiKey: openaiKey });
            providerReady.openai = true;
            console.log(JSON.stringify({ severity: 'INFO', message: 'OpenAI initialized' }));
        }
    } catch (e) {
        console.log(JSON.stringify({ severity: 'WARNING', message: 'OpenAI not configured', error: String(e) }));
    }

    // Anthropic
    try {
        const anthropicKey = await loadSecret('ANTHROPIC_API_KEY', 'anthropic-api-key');
        if (anthropicKey) {
            anthropicClient = new Anthropic({ apiKey: anthropicKey });
            providerReady.anthropic = true;
            console.log(JSON.stringify({ severity: 'INFO', message: 'Anthropic initialized' }));
        }
    } catch (e) {
        console.log(JSON.stringify({ severity: 'WARNING', message: 'Anthropic not configured', error: String(e) }));
    }

    isInitialized = true;
}

/**
 * Get or create a Gemini model instance
 */
function getOrCreateModel(modelId: string = DEFAULT_MODEL): GenerativeModel | null {
    if (!genAI) return null;
    const validModelId = modelId in SUPPORTED_MODELS ? modelId : DEFAULT_MODEL;
    if (!modelCache.has(validModelId)) {
        const model = genAI.getGenerativeModel({ model: validModelId });
        modelCache.set(validModelId, model);
    }
    return modelCache.get(validModelId) || null;
}

/**
 * Unified text generation - routes to correct provider based on model ID
 */
async function generateText(prompt: string, modelId: string = DEFAULT_MODEL): Promise<string> {
    const model = SUPPORTED_MODELS[modelId];
    const provider = model?.provider || 'google';
    const resolvedModelId = model ? modelId : DEFAULT_MODEL;

    switch (provider) {
        case 'openai': {
            if (!openaiClient) throw new Error('OpenAI 未配置。請設定 OPENAI_API_KEY。');
            const completion = await openaiClient.chat.completions.create({
                model: resolvedModelId,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4096,
            });
            return completion.choices[0]?.message?.content || '';
        }
        case 'anthropic': {
            if (!anthropicClient) throw new Error('Anthropic 未配置。請設定 ANTHROPIC_API_KEY。');
            const message = await anthropicClient.messages.create({
                model: resolvedModelId,
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt }],
            });
            const block = message.content[0];
            return block.type === 'text' ? block.text : '';
        }
        case 'google':
        default: {
            const geminiModel = getOrCreateModel(resolvedModelId);
            if (!geminiModel) throw new Error('Gemini 未配置。請設定 GEMINI_API_KEY。');
            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            return response.text();
        }
    }
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        service: 'ai-gateway',
        providers: providerReady,
        defaultModel: DEFAULT_MODEL,
        timestamp: new Date().toISOString()
    });
});

// Model info endpoint - shows only models whose provider is ready
app.get('/ai/models', (_req: Request, res: Response) => {
    const models = Object.entries(SUPPORTED_MODELS)
        .filter(([, info]) => providerReady[info.provider])
        .map(([id, info]) => ({
            id,
            ...info,
            isDefault: id === DEFAULT_MODEL,
        }));
    
    // Also include unavailable providers marked as such
    const unavailable = Object.entries(SUPPORTED_MODELS)
        .filter(([, info]) => !providerReady[info.provider])
        .map(([id, info]) => ({
            id,
            ...info,
            isDefault: false,
            available: false,
        }));

    res.json({ models, unavailable, defaultModel: DEFAULT_MODEL, providers: providerReady });
});

// ============ AI Endpoints ============

/**
 * POST /ai/summarize
 * Generate text summary
 */
app.post('/ai/summarize', async (req: Request, res: Response) => {
    try {
        await initializeProviders();
        const { text, maxLength = 200, language = 'zh-TW', model: modelId } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Missing required field: text' });
        }

        const prompt = `請用${language}簡潔摘要以下內容，最多${maxLength}字：\n\n${text}`;
        const summary = await generateText(prompt, modelId);
        res.json({ summary });
    } catch (error) {
        console.error('Summarize error:', error);
        res.status(500).json({ error: 'Failed to generate summary' });
    }
});

/**
 * POST /ai/sentiment
 * Analyze sentiment of text
 */
app.post('/ai/sentiment', async (req: Request, res: Response) => {
    try {
        await initializeProviders();
        const { text, context, model: modelId } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Missing required field: text' });
        }

        const prompt = `分析以下文字的情緒，以 JSON 格式回應：
{
  "label": "positive" | "negative" | "neutral" | "mixed",
  "score": 數值 (-1 到 1),
  "confidence": 數值 (0 到 1),
  "emotions": {
    "joy": 0-1,
    "anger": 0-1,
    "fear": 0-1,
    "sadness": 0-1,
    "surprise": 0-1
  },
  "keywords": ["關鍵詞1", "關鍵詞2"]
}

${context ? `背景：${context}\n` : ''}
文字：${text}

只回應 JSON，不要其他文字。`;

        const responseText = await generateText(prompt, modelId);
        const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const sentiment = JSON.parse(cleanJson);
        res.json(sentiment);
    } catch (error) {
        console.error('Sentiment error:', error);
        res.status(500).json({ error: 'Failed to analyze sentiment' });
    }
});

/**
 * POST /ai/impact
 * Assess impact of news/event on market
 */
app.post('/ai/impact', async (req: Request, res: Response) => {
    try {
        await initializeProviders();
        const { title, content, symbols = [], newsType, model: modelId } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Missing required field: title' });
        }

        const prompt = `評估以下新聞對市場的影響，以 JSON 格式回應：
{
  "severity": 0-100,
  "confidence": 0-1,
  "direction": "bullish" | "bearish" | "neutral" | "mixed",
  "timeframe": "immediate" | "short_term" | "long_term",
  "affectedSectors": [],
  "affectedSymbols": [],
  "explanation": "",
  "scores": { "market": 0-100, "news": 0-100, "social": 0-100 }
}

新聞標題：${title}
${content ? `內容：${content}` : ''}
${symbols.length > 0 ? `相關標的：${symbols.join(', ')}` : ''}
${newsType ? `類型：${newsType}` : ''}

只回應 JSON，不要其他文字。`;

        const responseText = await generateText(prompt, modelId);
        const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const impact = JSON.parse(cleanJson);
        res.json(impact);
    } catch (error) {
        console.error('Impact error:', error);
        res.status(500).json({ error: 'Failed to assess impact' });
    }
});

/**
 * POST /ai/chat
 * General chat/Q&A
 */
app.post('/ai/chat', async (req: Request, res: Response) => {
    try {
        await initializeProviders();
        const { message, context, systemPrompt, model: modelId } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Missing required field: message' });
        }

        const fullPrompt = [
            systemPrompt || '你是一位專業的投資分析助理，請用繁體中文回答。',
            context ? `背景資訊：${context}` : '',
            `用戶問題：${message}`
        ].filter(Boolean).join('\n\n');

        const reply = await generateText(fullPrompt, modelId);
        res.json({ reply });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

/**
 * POST /ai/batch-sentiment
 * Batch sentiment analysis
 */
app.post('/ai/batch-sentiment', async (req: Request, res: Response) => {
    try {
        await initializeProviders();
        const { items, model: modelId } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Missing or invalid items array' });
        }

        const batchItems = items.slice(0, 20);
        const prompt = `分析以下多則文字的情緒，以 JSON 陣列格式回應。
每個項目需要：id, label (positive/negative/neutral/mixed), score (-1到1), confidence (0到1)

文字列表：
${batchItems.map((item: { id: string; content: string }, i: number) =>
            `${i + 1}. [ID: ${item.id}] ${item.content.substring(0, 200)}`
        ).join('\n')}

只回應 JSON 陣列，格式如：
[{"id": "xxx", "label": "positive", "score": 0.8, "confidence": 0.9}, ...]`;

        const responseText = await generateText(prompt, modelId);
        const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const results = JSON.parse(cleanJson);
        res.json({ results });
    } catch (error) {
        console.error('Batch sentiment error:', error);
        res.status(500).json({ error: 'Failed to analyze batch sentiment' });
    }
});

// Butler context-enriched chat endpoint
// Accepts user data context (health, finance, vehicle, calendar) for personalized responses
app.post('/ai/butler/chat', async (req: Request, res: Response) => {
    try {
        await initializeProviders();
        const { message, model: modelId, context, conversationHistory } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Missing message' });
        }

        const contextSections: string[] = [];
        if (context?.health) contextSections.push(`## 用戶健康數據\n${JSON.stringify(context.health, null, 2)}`);
        if (context?.finance) contextSections.push(`## 用戶財務摘要\n${JSON.stringify(context.finance, null, 2)}`);
        if (context?.vehicle) contextSections.push(`## 用戶車輛資訊\n${JSON.stringify(context.vehicle, null, 2)}`);
        if (context?.calendar) contextSections.push(`## 用戶行事曆\n${JSON.stringify(context.calendar, null, 2)}`);

        const systemPrompt = `你是「小秘書」，專業的個人智能管家助理。
友善、專業、高效。針對用戶問題提供精準回答。

${contextSections.length > 0 ? '# 用戶個人數據\n' + contextSections.join('\n\n') : ''}

## 回應規則
- 使用繁體中文回應
- 回答要簡潔明瞭
- 涉及數據時引用實際數字
- 如果數據不足，坦誠告知並建議記錄`;

        const parts: string[] = [];
        if (conversationHistory?.length) {
            for (const msg of conversationHistory.slice(-6)) {
                parts.push(`${msg.role === 'user' ? '用戶' : '助理'}: ${msg.content}`);
            }
        }
        parts.push(`用戶: ${message}`);

        const fullPrompt = `${systemPrompt}\n\n${parts.join('\n')}`;
        const reply = await generateText(fullPrompt, modelId);

        res.json({
            response: reply,
            model: modelId || DEFAULT_MODEL,
            hasContext: contextSections.length > 0,
        });
    } catch (error) {
        console.error('Butler chat error:', error);
        res.status(500).json({ error: 'Failed to generate butler response' });
    }
});

// API Versioning: /v1/ai/* forwards to /ai/*
// Allows future /v2/ai/* with breaking changes
app.use('/v1', (req: Request, res: Response, next: NextFunction) => {
    // Forward /v1/ai/* requests to /ai/* routes
    req.url = req.url; // URL is already correct after /v1 prefix strip
    next();
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(JSON.stringify({
        severity: 'ERROR',
        message: err.message,
        stack: err.stack
    }));
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
    console.log(JSON.stringify({
        severity: 'INFO',
        message: `AI Gateway listening on port ${PORT}`
    }));

    // Pre-initialize all AI providers
    await initializeProviders();
});

export default app;
