/**
 * swagger.ts — L1: OpenAPI 3.0 自動文件 (D-2)
 *
 * 功能:
 *   - /api-docs → Swagger UI（僅非生產環境）
 *   - /openapi.json → 原始 OpenAPI 3.0 JSON（可供 CI 驗證或 Postman 匯入）
 *
 * 使用方式（app.ts 引入）:
 *   import { setupSwagger } from './swagger';
 *   setupSwagger(app);
 *
 * 路由加 JSDoc tag 範例:
 *   @openapi
 *   /agents/accountant/chat:
 *     post:
 *       summary: 會計師 AI 問答
 *       tags: [Accountant]
 */

import type { Application, Request, Response } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// ── OpenAPI 基礎定義 ─────────────────────────────────────────
const definition: swaggerJsdoc.OAS3Definition = {
  openapi: '3.0.0',
  info: {
    title: 'XXT-AGENT OpenClaw Gateway API',
    version: '8.0.0',
    description: `
## XXT-AGENT v8.0 — 智能幕僚系統 API

OpenClaw Gateway 是 XXT-AGENT 的統一 AI 閘道，整合以下功能：
- **9 個 AI Agent**（財務、工程、業務、法務、公益等）
- **三層隱私路由**（PRIVATE → Ollama 本地 / INTERNAL/PUBLIC → Gemini 雲端）
- **跨 Agent 協作**（Write Request Queue + Agent Bus）
- **Firebase Auth JWT** 驗證

> ⚠️ 本文件為開發環境限定（\`DEPLOY_MODE != production\`）
    `.trim(),
    contact: {
      name: 'XXT-AGENT 開發團隊',
      email: 'dev@xxt-agent.com',
    },
    license: { name: 'MIT' },
  },
  servers: [
    { url: 'http://localhost:3100', description: '本地開發環境' },
    { url: 'https://openclaw-gateway-xxx.run.app', description: 'Cloud Run 生產環境' },
  ],
  tags: [
    { name: 'System',     description: '系統健康 / VRAM / 設定' },
    { name: 'Accountant', description: '💼 Kay — 會計師幕僚（財務 PRIVATE）' },
    { name: 'Finance',    description: '📈 Finance — Investment Brain 投資策略' },
    { name: 'Guardian',   description: '🛡️ Guardian — 保險管理' },
    { name: 'BIM',        description: '🏗️ Titan — BIM/建築設計' },
    { name: 'Interior',   description: '🎨 Lumi — 室內設計' },
    { name: 'Estimator',  description: '📐 Rusty — 數量估算' },
    { name: 'Scout',      description: '🚁 Scout — UAV 任務管理' },
    { name: 'Zora',       description: '💜 Zora — 公益募款' },
    { name: 'Lex',        description: '⚖️ Lex — 合約法務' },
    { name: 'Nova',       description: '🔮 Nova — 人事管理（薪資/勞基法合規）' },
    { name: 'Regulation', description: '📚 Regulation RAG — 法規資料庫查詢' },
    { name: 'Events',     description: '📡 事件匯流（WebSocket + REST）' },
    { name: 'Deliberation', description: '🧠 L1 Agent 集體討論' },
    { name: 'Audit',      description: '🔍 稽核日誌查詢' },
  ],
  components: {
    securitySchemes: {
      FirebaseAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Firebase Auth ID Token（使用 `getIdToken()` 取得）',
      },
    },
    schemas: {
      // ── 通用回應 ───────────────────────────────────────────
      ErrorResponse: {
        type: 'object',
        properties: {
          error:  { type: 'string', example: 'message is required' },
          detail: { type: 'string', example: 'Validation failed' },
        },
      },
      AgentChatRequest: {
        type: 'object',
        required: ['message'],
        properties: {
          message:    { type: 'string', example: '幫我計算含稅金額 NT$10,500 的未稅金額' },
          context:    { type: 'string', description: '額外背景資訊' },
          session_id: { type: 'string', format: 'uuid' },
          user_id:    { type: 'string' },
        },
      },
      AgentChatResponse: {
        type: 'object',
        properties: {
          agent_id:       { type: 'string', example: 'accountant' },
          model:          { type: 'string', example: 'qwen3:14b' },
          inference_route:{ type: 'string', enum: ['local', 'cloud'], example: 'local' },
          privacy_level:  { type: 'string', enum: ['PRIVATE', 'INTERNAL', 'PUBLIC'] },
          rag_used:       { type: 'string', nullable: true, enum: ['tax', 'labor', null] },
          trace_id:       { type: 'string', format: 'uuid' },
          latency_ms:     { type: 'integer', example: 1240 },
          reply:          { type: 'string', example: '未稅金額為 NT$10,000，營業稅 NT$500。' },
        },
      },
      LedgerEntry: {
        type: 'object',
        required: ['type', 'category', 'description', 'amount'],
        properties: {
          type:             { type: 'string', enum: ['income', 'expense'] },
          category:         { type: 'string', example: 'engineering_payment' },
          description:      { type: 'string', example: '南港工程 6月請款' },
          amount:           { type: 'number', example: 1050000 },
          amount_type:      { type: 'string', enum: ['taxed', 'untaxed'], default: 'taxed' },
          tax_rate:         { type: 'number', example: 5 },
          is_tax_exempt:    { type: 'boolean', default: false },
          transaction_date: { type: 'string', format: 'date', example: '2026-04-14' },
          invoice_no:       { type: 'string', example: 'AB-12345678' },
          entity_type:      { type: 'string', enum: ['personal','family','co_construction','co_renovation','co_design','co_drone','assoc_rescue'] },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status:       { type: 'string', example: 'ok' },
          deploy_mode:  { type: 'string', example: 'local' },
          server_time:  { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  // 全局安全（所有路由預設需要 Firebase Auth）
  security: [{ FirebaseAuth: [] }],
};

// ── swagger-jsdoc 設定 ───────────────────────────────────────
const options: swaggerJsdoc.Options = {
  definition,
  apis: [
    './src/routes/**/*.ts',      // 子路由 JSDoc
    './src/app.ts',              // 主應用
  ],
};

// ── 匯出 Express 掛載函數 ────────────────────────────────────
export function setupSwagger(app: Application): void {
  const deployMode = process.env['DEPLOY_MODE'] ?? 'local';
  if (deployMode === 'production') {
    // 生產環境不暴露 API 文件
    return;
  }

  const spec = swaggerJsdoc(options);

  // Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'XXT-AGENT OpenClaw API Docs',
      customCss: `
        .swagger-ui .topbar { background: #0f172a; }
        .swagger-ui .topbar-wrapper .link span { color: #38bdf8; }
        .swagger-ui .info .title { color: #0f172a; }
      `,
      swaggerOptions: {
        docExpansion: 'list',          // 預設折疊，列表展示
        filter: true,                  // 啟用搜尋過濾
        persistAuthorization: true,    // 保留 Bearer token 輸入
      },
    }),
  );

  // 原始 JSON（供 Postman 匯入 / CI 驗證）
  app.get('/openapi.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(spec);
  });

  const port = process.env['PORT'] ?? '3100';
  // 使用 process.nextTick 避免在 module 初始化時就打印
  process.nextTick(() => {
    console.info(`[Swagger] API Docs: http://localhost:${port}/api-docs`);
    console.info(`[Swagger] OpenAPI JSON: http://localhost:${port}/openapi.json`);
  });
}
