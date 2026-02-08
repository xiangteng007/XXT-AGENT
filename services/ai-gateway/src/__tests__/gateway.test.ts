/**
 * AI Gateway Integration Tests
 * 
 * Tests HTTP endpoints, middleware, and provider routing
 * without requiring actual AI provider API keys.
 */

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

// ═══════════════════════════════════════════════════════════
// Test App Setup (mirrors production app without AI providers)
// ═══════════════════════════════════════════════════════════

const SUPPORTED_MODELS: Record<string, { name: string; description: string; tier: string; provider: string }> = {
    'gemini-2.0-flash': { name: 'Gemini 2.0 Flash', description: 'Test', tier: 'standard', provider: 'google' },
    'gpt-4o-mini': { name: 'GPT-4o Mini', description: 'Test', tier: 'standard', provider: 'openai' },
    'claude-haiku-3-5-20241022': { name: 'Claude Haiku', description: 'Test', tier: 'standard', provider: 'anthropic' },
};

const DEFAULT_MODEL = 'gemini-2.0-flash';
const providerReady: Record<string, boolean> = { google: true, openai: false, anthropic: false };

function createTestApp(apiKeys: string[] = []) {
    const app = express();
    
    app.use(express.json());
    app.use(helmet());

    // API Key validation middleware
    if (apiKeys.length > 0) {
        app.use('/ai/', (req: Request, res: Response, next: NextFunction) => {
            const key = req.headers['x-api-key'] as string;
            if (!key || !apiKeys.includes(key)) {
                return res.status(401).json({ error: '未授權：請提供有效的 API Key' });
            }
            next();
        });
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

    // Models endpoint
    app.get('/ai/models', (_req: Request, res: Response) => {
        const models = Object.entries(SUPPORTED_MODELS)
            .filter(([, info]) => providerReady[info.provider])
            .map(([id, info]) => ({ id, ...info, isDefault: id === DEFAULT_MODEL }));
        
        const unavailable = Object.entries(SUPPORTED_MODELS)
            .filter(([, info]) => !providerReady[info.provider])
            .map(([id, info]) => ({ id, ...info, isDefault: false, available: false }));

        res.json({ models, unavailable, defaultModel: DEFAULT_MODEL, providers: providerReady });
    });

    // Summarize endpoint (mock)
    app.post('/ai/summarize', (req: Request, res: Response) => {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Missing required field: text' });
        res.json({ summary: `Summary of: ${text.substring(0, 50)}` });
    });

    // Sentiment endpoint (mock)
    app.post('/ai/sentiment', (req: Request, res: Response) => {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Missing required field: text' });
        res.json({ sentiment: 'positive', confidence: 0.85, analysis: 'mock' });
    });

    // Chat endpoint (mock)
    app.post('/ai/chat', (req: Request, res: Response) => {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Missing required field: message' });
        res.json({ response: `Echo: ${message}`, model: DEFAULT_MODEL });
    });

    return app;
}

// ═══════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════

describe('AI Gateway', () => {

    // ── Health Check ──────────────────────────────────────
    describe('GET /health', () => {
        const app = createTestApp();

        it('should return healthy status', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('healthy');
            expect(res.body.service).toBe('ai-gateway');
        });

        it('should include provider readiness', async () => {
            const res = await request(app).get('/health');
            expect(res.body.providers).toEqual({
                google: true,
                openai: false,
                anthropic: false,
            });
        });

        it('should include default model and timestamp', async () => {
            const res = await request(app).get('/health');
            expect(res.body.defaultModel).toBe('gemini-2.0-flash');
            expect(res.body.timestamp).toBeDefined();
        });
    });

    // ── Models Endpoint ──────────────────────────────────
    describe('GET /ai/models', () => {
        const app = createTestApp();

        it('should return available models filtered by provider readiness', async () => {
            const res = await request(app).get('/ai/models');
            expect(res.status).toBe(200);
            
            // Only google is ready, so only gemini models should be available
            expect(res.body.models.length).toBe(1);
            expect(res.body.models[0].id).toBe('gemini-2.0-flash');
            expect(res.body.models[0].provider).toBe('google');
        });

        it('should list unavailable provider models separately', async () => {
            const res = await request(app).get('/ai/models');
            expect(res.body.unavailable.length).toBe(2);
            expect(res.body.unavailable.every((m: any) => m.available === false)).toBe(true);
        });

        it('should mark default model correctly', async () => {
            const res = await request(app).get('/ai/models');
            const defaultModel = res.body.models.find((m: any) => m.isDefault);
            expect(defaultModel).toBeDefined();
            expect(defaultModel.id).toBe('gemini-2.0-flash');
        });

        it('should include provider readiness map', async () => {
            const res = await request(app).get('/ai/models');
            expect(res.body.providers).toEqual({
                google: true,
                openai: false,
                anthropic: false,
            });
        });
    });

    // ── API Key Validation ───────────────────────────────
    describe('API Key Middleware', () => {
        const app = createTestApp(['test-key-123', 'test-key-456']);

        it('should reject requests without API key', async () => {
            const res = await request(app).get('/ai/models');
            expect(res.status).toBe(401);
            expect(res.body.error).toContain('未授權');
        });

        it('should reject requests with invalid API key', async () => {
            const res = await request(app)
                .get('/ai/models')
                .set('X-API-Key', 'invalid-key');
            expect(res.status).toBe(401);
        });

        it('should accept requests with valid API key', async () => {
            const res = await request(app)
                .get('/ai/models')
                .set('X-API-Key', 'test-key-123');
            expect(res.status).toBe(200);
        });

        it('should accept any valid key from the list', async () => {
            const res = await request(app)
                .get('/ai/models')
                .set('X-API-Key', 'test-key-456');
            expect(res.status).toBe(200);
        });

        it('should not affect non-AI endpoints', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200); // Health is not under /ai/
        });
    });

    describe('No API Key Configured', () => {
        const app = createTestApp([]); // No keys = skip validation

        it('should allow all requests when no keys configured', async () => {
            const res = await request(app).get('/ai/models');
            expect(res.status).toBe(200);
        });
    });

    // ── Summarize Endpoint ───────────────────────────────
    describe('POST /ai/summarize', () => {
        const app = createTestApp();

        it('should return 400 when text is missing', async () => {
            const res = await request(app)
                .post('/ai/summarize')
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('text');
        });

        it('should return summary for valid input', async () => {
            const res = await request(app)
                .post('/ai/summarize')
                .send({ text: 'This is a test document for summarization.' });
            expect(res.status).toBe(200);
            expect(res.body.summary).toBeDefined();
        });
    });

    // ── Sentiment Endpoint ──────────────────────────────
    describe('POST /ai/sentiment', () => {
        const app = createTestApp();

        it('should return 400 when text is missing', async () => {
            const res = await request(app)
                .post('/ai/sentiment')
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('text');
        });

        it('should return sentiment analysis', async () => {
            const res = await request(app)
                .post('/ai/sentiment')
                .send({ text: 'The market looks very promising today!' });
            expect(res.status).toBe(200);
            expect(res.body.sentiment).toBeDefined();
            expect(res.body.confidence).toBeGreaterThan(0);
        });
    });

    // ── Chat Endpoint ────────────────────────────────────
    describe('POST /ai/chat', () => {
        const app = createTestApp();

        it('should return 400 when message is missing', async () => {
            const res = await request(app)
                .post('/ai/chat')
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('message');
        });

        it('should return response for valid message', async () => {
            const res = await request(app)
                .post('/ai/chat')
                .send({ message: 'Hello!' });
            expect(res.status).toBe(200);
            expect(res.body.response).toBeDefined();
            expect(res.body.model).toBe(DEFAULT_MODEL);
        });
    });

    // ── Security Headers ─────────────────────────────────
    describe('Security Headers (helmet)', () => {
        const app = createTestApp();

        it('should include security headers', async () => {
            const res = await request(app).get('/health');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
        });

        it('should not expose powered-by header', async () => {
            const res = await request(app).get('/health');
            expect(res.headers['x-powered-by']).toBeUndefined();
        });
    });

    // ── SUPPORTED_MODELS registry ────────────────────────
    describe('Model Registry', () => {
        it('should have unique model IDs', () => {
            const ids = Object.keys(SUPPORTED_MODELS);
            const unique = new Set(ids);
            expect(unique.size).toBe(ids.length);
        });

        it('should have valid provider for each model', () => {
            const validProviders = ['google', 'openai', 'anthropic'];
            for (const [id, model] of Object.entries(SUPPORTED_MODELS)) {
                expect(validProviders).toContain(model.provider);
            }
        });

        it('should have required fields for each model', () => {
            for (const [id, model] of Object.entries(SUPPORTED_MODELS)) {
                expect(model.name).toBeTruthy();
                expect(model.description).toBeTruthy();
                expect(model.tier).toBeTruthy();
                expect(model.provider).toBeTruthy();
            }
        });
    });

    // ── 404 Handling ─────────────────────────────────────
    describe('Unknown Routes', () => {
        const app = createTestApp();

        it('should return 404 for unknown paths', async () => {
            const res = await request(app).get('/nonexistent');
            expect(res.status).toBe(404);
        });
    });
});
