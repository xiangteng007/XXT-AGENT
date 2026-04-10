/**
 * accountant/index.ts — CR-02 路由模組 Barrel Export
 *
 * 向後兼容：原始 `import { accountantRouter } from './routes/accountant'`
 * 仍然可以正常引入。模組內部已拆分為：
 *   - prompts.ts  — 系統 Prompt 定義
 *   - helpers.ts  — RAG 查詢等工具函數
 *   - index.ts    — 路由定義 + re-export
 *
 * Future: 路由本體也應進一步拆分為 chat/ledger/bank/report 子路由。
 */

export { accountantRouter } from '../accountant';
export { queryRag, detectRagCategory, AGENT_ID, MODEL } from './helpers';
