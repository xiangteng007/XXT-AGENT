"use strict";
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
// ── 本機模式：優先載入 .env.local ──────────────────────────
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envLocalPath)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: envLocalPath });
    console.log('[Server] 📁 Loaded .env.local (Local Desktop Mode)');
}
else if (fs.existsSync(envPath)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: envPath });
    console.log('[Server] 📁 Loaded .env');
}
const express_1 = __importDefault(require("express"));
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin SDK
// - Cloud Run: Application Default Credentials
// - Local:     gcloud auth application-default login 產生的 ADC
if (!admin.apps.length) {
    admin.initializeApp();
}
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = parseInt(process.env.PORT || '3000', 10);
const IS_LOCAL = !process.env.K_SERVICE; // K_SERVICE 是 Cloud Run 專屬環境變數
// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'telegram-bot', ts: new Date().toISOString() });
});
// ─── Telegram Webhook ─────────────────────────────────────────────────────────
app.post('/telegram', async (req, res) => {
    try {
        const { handleTelegramWebhook } = await Promise.resolve().then(() => __importStar(require('./handlers/telegram-webhook.handler')));
        await handleTelegramWebhook(req, res);
    }
    catch (err) {
        console.error('[Server] Telegram handler error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// ─── Butler API ────────────────────────────────────────────────────────────────
app.use('/butler', async (req, res) => {
    try {
        const { handleButlerApi } = await Promise.resolve().then(() => __importStar(require('./handlers/butler-api.handler')));
        await handleButlerApi(req, res);
    }
    catch (err) {
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
exports.default = app;
//# sourceMappingURL=server.js.map