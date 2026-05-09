"use strict";
/**
 * AI Gateway Service (v9.0)
 *
 * Multi-provider AI gateway supporting Gemini, OpenAI GPT, and Anthropic Claude.
 * - Loads API keys from Secret Manager (not exposed to frontend)
 * - Provides unified REST endpoints for AI operations
 * - Rate limiting and request validation
 * - MCP-ready architecture (providers + tools separation)
 *
 * Refactored 2026-03-27: Split from monolithic 573-line file into modules.
 * v9.0: OpenTelemetry 全鏈路追蹤已啟用
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ── OTEL Instrumentation（必須在所有其他 import 之前）──────────
require("./tracing");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const Sentry = __importStar(require("@sentry/node"));
const config_1 = require("./config");
const providers_1 = require("./providers");
// Initialize Sentry for error tracking
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.2,
        environment: process.env.NODE_ENV || 'production',
    });
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
// ── Middleware ────────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:3000',
        'https://xxt-agent-dashboard.vercel.app',
        /\.vercel\.app$/
    ],
    credentials: true
}));
app.use(express_1.default.json({ limit: '1mb' }));
app.use((0, helmet_1.default)());
// API Key validation for AI endpoints
const API_KEYS = (process.env.AI_GATEWAY_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
console.log(JSON.stringify({ severity: 'INFO', message: `API Key auth: ${API_KEYS.length} key(s) configured` }));
app.use('/ai/', (req, res, next) => {
    if (API_KEYS.length === 0)
        return next(); // Skip if no keys configured
    const key = (req.headers['x-api-key'] || '').trim();
    if (!key || !API_KEYS.includes(key)) {
        return res.status(401).json({ error: '未授權：請提供有效的 API Key' });
    }
    next();
});
// Rate limiting: 30 requests per minute per IP
app.use('/ai/', (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '請求過於頻繁，請稍後再試' }
}));
// Request logging
app.use((req, _res, next) => {
    console.log(JSON.stringify({
        severity: 'INFO',
        message: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
    }));
    next();
});
// ── Health Check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        service: 'ai-gateway',
        version: '2.1.0',
        providers: (0, providers_1.getProviderStatus)(),
        defaultModel: config_1.DEFAULT_MODEL,
        timestamp: new Date().toISOString()
    });
});
// ── Model Info ───────────────────────────────────────────────
app.get('/ai/models', (_req, res) => {
    const providerReady = (0, providers_1.getProviderStatus)();
    const models = Object.entries(config_1.SUPPORTED_MODELS)
        .filter(([, info]) => providerReady[info.provider] && !info.deprecated)
        .map(([id, info]) => ({
        id,
        ...info,
        isDefault: id === config_1.DEFAULT_MODEL,
    }));
    const deprecated = Object.entries(config_1.SUPPORTED_MODELS)
        .filter(([, info]) => info.deprecated)
        .map(([id, info]) => ({
        id,
        ...info,
        isDefault: false,
        available: false,
        reason: 'deprecated',
    }));
    const unavailable = Object.entries(config_1.SUPPORTED_MODELS)
        .filter(([, info]) => !providerReady[info.provider] && !info.deprecated)
        .map(([id, info]) => ({
        id,
        ...info,
        isDefault: false,
        available: false,
        reason: 'provider_not_configured',
    }));
    res.json({
        models,
        unavailable,
        deprecated,
        defaultModel: config_1.DEFAULT_MODEL,
        providers: providerReady,
        totalModels: Object.keys(config_1.SUPPORTED_MODELS).length,
    });
});
// ── AI Endpoints ─────────────────────────────────────────────
// Helper: parse JSON from AI response
function parseJsonResponse(text) {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
}
/**
 * POST /ai/summarize — Generate text summary
 */
app.post('/ai/summarize', async (req, res) => {
    try {
        await (0, providers_1.initializeProviders)();
        const { text, maxLength = 200, language = 'zh-TW', model: modelId } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Missing required field: text' });
        }
        const prompt = `請用${language}簡潔摘要以下內容，最多${maxLength}字：\n\n${text}`;
        const summary = await (0, providers_1.generateText)(prompt, modelId);
        res.json({ summary, model: modelId || config_1.DEFAULT_MODEL });
    }
    catch (error) {
        console.error('Summarize error:', error);
        res.status(500).json({ error: 'Failed to generate summary' });
    }
});
/**
 * POST /ai/sentiment — Analyze sentiment of text
 */
app.post('/ai/sentiment', async (req, res) => {
    try {
        await (0, providers_1.initializeProviders)();
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
        const responseText = await (0, providers_1.generateText)(prompt, modelId);
        const sentiment = parseJsonResponse(responseText);
        res.json(sentiment);
    }
    catch (error) {
        console.error('Sentiment error:', error);
        res.status(500).json({ error: 'Failed to analyze sentiment' });
    }
});
/**
 * POST /ai/impact — Assess impact of news/event on market
 */
app.post('/ai/impact', async (req, res) => {
    try {
        await (0, providers_1.initializeProviders)();
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
        const responseText = await (0, providers_1.generateText)(prompt, modelId);
        const impact = parseJsonResponse(responseText);
        res.json(impact);
    }
    catch (error) {
        console.error('Impact error:', error);
        res.status(500).json({ error: 'Failed to assess impact' });
    }
});
/**
 * POST /ai/chat — General chat/Q&A
 */
app.post('/ai/chat', async (req, res) => {
    try {
        await (0, providers_1.initializeProviders)();
        const { message, context, systemPrompt, model: modelId } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Missing required field: message' });
        }
        const fullPrompt = [
            systemPrompt || '你是一位專業的投資分析助理，請用繁體中文回答。',
            context ? `背景資訊：${context}` : '',
            `用戶問題：${message}`
        ].filter(Boolean).join('\n\n');
        const reply = await (0, providers_1.generateText)(fullPrompt, modelId);
        res.json({ reply, model: modelId || config_1.DEFAULT_MODEL });
    }
    catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});
/**
 * POST /ai/batch-sentiment — Batch sentiment analysis
 */
app.post('/ai/batch-sentiment', async (req, res) => {
    try {
        await (0, providers_1.initializeProviders)();
        const { items, model: modelId } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Missing or invalid items array' });
        }
        const batchItems = items.slice(0, 20);
        const prompt = `分析以下多則文字的情緒，以 JSON 陣列格式回應。
每個項目需要：id, label (positive/negative/neutral/mixed), score (-1到1), confidence (0到1)

文字列表：
${batchItems.map((item, i) => `${i + 1}. [ID: ${item.id}] ${item.content.substring(0, 200)}`).join('\n')}

只回應 JSON 陣列，格式如：
[{"id": "xxx", "label": "positive", "score": 0.8, "confidence": 0.9}, ...]`;
        const responseText = await (0, providers_1.generateText)(prompt, modelId);
        const results = parseJsonResponse(responseText);
        res.json({ results });
    }
    catch (error) {
        console.error('Batch sentiment error:', error);
        res.status(500).json({ error: 'Failed to analyze batch sentiment' });
    }
});
/**
 * POST /ai/butler/chat — Butler context-enriched chat
 */
app.post('/ai/butler/chat', async (req, res) => {
    try {
        await (0, providers_1.initializeProviders)();
        const { message, model: modelId, context, conversationHistory } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Missing message' });
        }
        const contextSections = [];
        if (context?.health)
            contextSections.push(`## 用戶健康數據\n${JSON.stringify(context.health, null, 2)}`);
        if (context?.finance)
            contextSections.push(`## 用戶財務摘要\n${JSON.stringify(context.finance, null, 2)}`);
        if (context?.vehicle)
            contextSections.push(`## 用戶車輛資訊\n${JSON.stringify(context.vehicle, null, 2)}`);
        if (context?.calendar)
            contextSections.push(`## 用戶行事曆\n${JSON.stringify(context.calendar, null, 2)}`);
        const systemPrompt = `你是「小秘書」，專業的個人智能管家助理。
友善、專業、高效。針對用戶問題提供精準回答。

${contextSections.length > 0 ? '# 用戶個人數據\n' + contextSections.join('\n\n') : ''}

## 回應規則
- 使用繁體中文回應
- 回答要簡潔明瞭
- 涉及數據時引用實際數字
- 如果數據不足，坦誠告知並建議記錄`;
        const parts = [];
        if (conversationHistory?.length) {
            for (const msg of conversationHistory.slice(-6)) {
                parts.push(`${msg.role === 'user' ? '用戶' : '助理'}: ${msg.content}`);
            }
        }
        parts.push(`用戶: ${message}`);
        const fullPrompt = `${systemPrompt}\n\n${parts.join('\n')}`;
        const reply = await (0, providers_1.generateText)(fullPrompt, modelId);
        res.json({
            response: reply,
            model: modelId || config_1.DEFAULT_MODEL,
            hasContext: contextSections.length > 0,
        });
    }
    catch (error) {
        console.error('Butler chat error:', error);
        res.status(500).json({ error: 'Failed to generate butler response' });
    }
});
// ── API Versioning ───────────────────────────────────────────
app.use('/v1', (req, _res, next) => {
    req.url = req.url;
    next();
});
// ── Error Handling ───────────────────────────────────────────
if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
}
app.use((err, _req, res, _next) => {
    console.error(JSON.stringify({
        severity: 'ERROR',
        message: err.message,
        stack: err.stack
    }));
    res.status(500).json({ error: 'Internal server error' });
});
// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(JSON.stringify({
        severity: 'INFO',
        message: `AI Gateway v2.1.0 listening on port ${PORT}`
    }));
    await (0, providers_1.initializeProviders)();
});
exports.default = app;
