/**
 * Local Desktop / Cloud Run Entry Point
 *
 * Standalone Express HTTP server.
 * - Local Desktop: 讀取 .env.local，port 3000，使用 Cloudflare Tunnel 暴露
 * - Cloud Run:     使用 GCP Application Default Credentials，port 8080
 *
 * Secret priority (via config/secrets.ts):
 *   1. In-memory cache
 *   2. process.env (此處 dotenv 注入)
 *   3. GCP Secret Manager (fallback)
 */

// ── 本機模式：優先載入 .env.local ──────────────────────────
import * as path from 'path';
import * as fs from 'fs';

const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: envLocalPath });
    console.log('[Server] 📁 Loaded .env.local (Local Desktop Mode)');
} else if (fs.existsSync(envPath)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: envPath });
    console.log('[Server] 📁 Loaded .env');
}

import express from 'express';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// - Cloud Run: Application Default Credentials
// - Local:     gcloud auth application-default login 產生的 ADC
if (!admin.apps.length) {
    admin.initializeApp();
}

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '3000', 10);
const IS_LOCAL = !process.env.K_SERVICE; // K_SERVICE 是 Cloud Run 專屬環境變數

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'telegram-bot', ts: new Date().toISOString() });
});

// ─── Telegram Webhook ─────────────────────────────────────────────────────────
app.post('/telegram', async (req, res) => {
    try {
        const { handleTelegramWebhook } = await import('./handlers/telegram-webhook.handler');
        await handleTelegramWebhook(req as any, res as any);
    } catch (err) {
        console.error('[Server] Telegram handler error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── Butler API ────────────────────────────────────────────────────────────────
app.use('/butler', async (req, res) => {
    try {
        const { handleButlerApi } = await import('./handlers/butler-api.handler');
        await handleButlerApi(req as any, res as any);
    } catch (err) {
        console.error('[Server] Butler API error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    const mode = IS_LOCAL ? '🖥️  Local Desktop Mode' : '☁️  Cloud Run Mode';
    console.log(`[Server] XXT-AGENT Telegram Bot — ${mode}`);
    console.log(`[Server] Listening on port ${PORT}`);
    if (IS_LOCAL) {
        console.log(`[Server] Health: http://localhost:${PORT}/healthz`);
        console.log(`[Server] Webhook: http://localhost:${PORT}/telegram`);
        console.log(`[Server] Ollama: ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}`);
        console.log(`[Server] ChromaDB: ${process.env.CHROMADB_URL || '(not set)'}`);
        console.log('[Server] ⚡ Start Cloudflare Tunnel: scripts/cloudflared.exe tunnel --url http://localhost:' + PORT);
    }
});

export default app;
