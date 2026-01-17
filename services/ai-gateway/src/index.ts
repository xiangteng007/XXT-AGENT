/**
 * AI Gateway Service
 * 
 * Secure gateway for Gemini AI API calls.
 * - Loads API key from Secret Manager (not exposed to frontend)
 * - Provides REST endpoints for AI operations
 * - Rate limiting and request validation
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const app = express();
const PORT = process.env.PORT || 8080;
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'xxt-agent';
const SECRET_ID = process.env.GEMINI_SECRET_ID || 'gemini-api-key';

// State
let geminiModel: GenerativeModel | null = null;
let isInitialized = false;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://xxt-frontend.vercel.app',
        /\.vercel\.app$/
    ],
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

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
 * Load Gemini API key from Secret Manager
 */
async function loadGeminiKey(): Promise<string> {
    // In development, use environment variable
    if (process.env.GEMINI_API_KEY) {
        return process.env.GEMINI_API_KEY;
    }

    // In production, use Secret Manager
    try {
        const client = new SecretManagerServiceClient();
        const name = `projects/${PROJECT_ID}/secrets/${SECRET_ID}/versions/latest`;
        const [response] = await client.accessSecretVersion({ name });
        const payload = response.payload?.data;

        if (!payload) {
            throw new Error('Empty secret payload');
        }

        if (typeof payload === 'string') {
            return payload;
        }

        return new TextDecoder('utf-8').decode(payload as Uint8Array);
    } catch (error) {
        console.error(JSON.stringify({
            severity: 'ERROR',
            message: 'Failed to load Gemini API key from Secret Manager',
            error: String(error)
        }));
        throw error;
    }
}

/**
 * Initialize Gemini client
 */
async function initializeGemini(): Promise<void> {
    if (isInitialized) return;

    try {
        const apiKey = await loadGeminiKey();
        const genAI = new GoogleGenerativeAI(apiKey);
        geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        isInitialized = true;
        console.log(JSON.stringify({
            severity: 'INFO',
            message: 'Gemini client initialized successfully'
        }));
    } catch (error) {
        console.error(JSON.stringify({
            severity: 'ERROR',
            message: 'Failed to initialize Gemini',
            error: String(error)
        }));
    }
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        service: 'ai-gateway',
        geminiReady: isInitialized,
        timestamp: new Date().toISOString()
    });
});

// ============ AI Endpoints ============

/**
 * POST /ai/summarize
 * Generate text summary
 */
app.post('/ai/summarize', async (req: Request, res: Response) => {
    try {
        if (!geminiModel) {
            await initializeGemini();
        }

        if (!geminiModel) {
            return res.status(503).json({ error: 'AI service unavailable' });
        }

        const { text, maxLength = 200, language = 'zh-TW' } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Missing required field: text' });
        }

        const prompt = `請用${language}簡潔摘要以下內容，最多${maxLength}字：\n\n${text}`;

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();

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
        if (!geminiModel) {
            await initializeGemini();
        }

        if (!geminiModel) {
            return res.status(503).json({ error: 'AI service unavailable' });
        }

        const { text, context } = req.body;

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

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        // Parse JSON response
        const cleanJson = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

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
        if (!geminiModel) {
            await initializeGemini();
        }

        if (!geminiModel) {
            return res.status(503).json({ error: 'AI service unavailable' });
        }

        const { title, content, symbols = [], newsType } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Missing required field: title' });
        }

        const prompt = `評估以下新聞對市場的影響，以 JSON 格式回應：
{
  "severity": 0-100 (影響嚴重程度),
  "confidence": 0-1 (信心度),
  "direction": "bullish" | "bearish" | "neutral" | "mixed",
  "timeframe": "immediate" | "short_term" | "long_term",
  "affectedSectors": ["科技", "金融", ...],
  "affectedSymbols": ["AAPL", "TSLA", ...],
  "explanation": "簡短解釋",
  "scores": {
    "market": 0-100,
    "news": 0-100,
    "social": 0-100
  }
}

新聞標題：${title}
${content ? `內容：${content}` : ''}
${symbols.length > 0 ? `相關標的：${symbols.join(', ')}` : ''}
${newsType ? `類型：${newsType}` : ''}

只回應 JSON，不要其他文字。`;

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        const cleanJson = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

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
        if (!geminiModel) {
            await initializeGemini();
        }

        if (!geminiModel) {
            return res.status(503).json({ error: 'AI service unavailable' });
        }

        const { message, context, systemPrompt } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Missing required field: message' });
        }

        const fullPrompt = [
            systemPrompt || '你是一位專業的投資分析助理，請用繁體中文回答。',
            context ? `背景資訊：${context}` : '',
            `用戶問題：${message}`
        ].filter(Boolean).join('\n\n');

        const result = await geminiModel.generateContent(fullPrompt);
        const response = await result.response;
        const reply = response.text();

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
        if (!geminiModel) {
            await initializeGemini();
        }

        if (!geminiModel) {
            return res.status(503).json({ error: 'AI service unavailable' });
        }

        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Missing or invalid items array' });
        }

        // Limit batch size
        const batchItems = items.slice(0, 20);

        const prompt = `分析以下多則文字的情緒，以 JSON 陣列格式回應。
每個項目需要：id, label (positive/negative/neutral/mixed), score (-1到1), confidence (0到1)

文字列表：
${batchItems.map((item: { id: string; content: string }, i: number) =>
            `${i + 1}. [ID: ${item.id}] ${item.content.substring(0, 200)}`
        ).join('\n')}

只回應 JSON 陣列，格式如：
[{"id": "xxx", "label": "positive", "score": 0.8, "confidence": 0.9}, ...]`;

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        const cleanJson = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        const results = JSON.parse(cleanJson);
        res.json({ results });
    } catch (error) {
        console.error('Batch sentiment error:', error);
        res.status(500).json({ error: 'Failed to analyze batch sentiment' });
    }
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

    // Pre-initialize Gemini
    await initializeGemini();
});

export default app;
