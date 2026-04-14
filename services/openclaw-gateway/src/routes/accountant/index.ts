/**
 * Accountant Agent Router — 主入口 (A-3 / CR-02)
 *
 * 將原本 917 行的 accountant.ts 拆分為四個子模組：
 *   - chat.ts    → POST /chat, /invoice, /payment, /tax, GET /health
 *   - ledger.ts  → POST/GET /ledger, GET /report/*, GET /export/csv
 *   - bank.ts    → POST/GET /bank/*
 *   - reports.ts → GET /report/entity, POST /taxplan
 *
 * 所有原有路徑保持 100% 向後相容，無破壞性變更。
 *
 * app.ts 使用方式不變：
 *   import { accountantRouter } from './routes/accountant';
 *   （或 './routes/accountant/index' — 兩者等價）
 */

import { Router } from 'express';
import { chatRouter } from './chat';
import { ledgerRouter } from './ledger';
import { bankRouter } from './bank';
import { reportsRouter } from './reports';

export const accountantRouter = Router();

// 掛載所有子路由（路徑完全繼承原 accountantRouter 的路由結構）
accountantRouter.use('/', chatRouter);      // /chat /invoice /payment /tax /health
accountantRouter.use('/', ledgerRouter);    // /ledger /report/summary /report/401 /report/annual /export/csv
accountantRouter.use('/', bankRouter);      // /bank/account /bank/accounts /bank/balance /bank/txn
accountantRouter.use('/', reportsRouter);   // /report/entity /taxplan

// 重新導出工具（保持舊有 import 相容性）
export { queryRag, detectRagCategory, AGENT_ID, MODEL } from './shared';
