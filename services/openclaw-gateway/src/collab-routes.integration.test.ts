/**
 * collab-routes.integration.test.ts
 *
 * C-1 跨 Agent 協作整合測試（Sprint 1 補充）
 * 覆蓋以下路由：
 *
 *   C-1a: POST /agents/scout/collab/lex          — Scout → Lex 合約建立
 *   C-1b: POST /agents/guardian/collab/auto-booking — Guardian → Accountant 保費記帳
 *         POST /agents/guardian/collab/accountant   — Guardian 查詢帳本資料
 *   C-1d: GET  /system/reconcile                  — 對帳引擎執行
 *         POST /system/reconcile                   — 手動觸發全量對帳
 *         GET  /system/reconcile/summary           — 對帳摘要
 *   E-3:  GET  /agents/sage/health                — Sage Agent 健康檢查
 *         POST /agents/sage/chat                   — Sage 分析請求（400 驗證）
 *   D-5:  GET  /system/agent-bus                  — Agent Bus 全系統狀態
 *         GET  /system/agent-bus/history           — Agent Bus 活動歷史
 *         GET  /system/ai-cost                     — AI 成本追蹤
 *         GET  /system/health                      — 系統深度健康狀態
 *         GET  /system/models                      — 可用模型清單
 *
 * 設計原則：
 *   - DEV_BYPASS_AUTH=true 跳過 Firebase Auth
 *   - NODE_ENV=test 跳過 Rate Limiter
 *   - 協作路由的 Write Request 為 in-memory enqueue，不依賴 Firestore
 *   - 對帳引擎在無帳本資料時仍應回傳 200（空記錄集合）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

process.env['DEV_BYPASS_AUTH'] = 'true';
process.env['NODE_ENV'] = 'test';
process.env['PRIVACY_ENFORCE_LOCAL'] = 'false';

let app: import('express').Express;

beforeAll(async () => {
  const mod = await import('./app');
  app = mod.app;
});

// ═══════════════════════════════════════════════════════════════
// § C-1a: Scout → Lex 協作（UAV 合約自動建立）
// ═══════════════════════════════════════════════════════════════

describe('C-1a: Scout → Lex Collaboration', () => {
  it('POST /agents/scout/collab/lex → 400 when mission_id missing', async () => {
    const res = await request(app)
      .post('/agents/scout/collab/lex')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /agents/scout/collab/lex → 404 when mission not found', async () => {
    const res = await request(app)
      .post('/agents/scout/collab/lex')
      .send({ mission_id: 'nonexistent-mission-uuid' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('POST /agents/scout/mission → 201 to create test mission first', async () => {
    const res = await request(app)
      .post('/agents/scout/mission')
      .send({
        mission_type: 'aerial_photo',
        title: '測試空拍任務',
        client_name: '測試客戶有限公司',
        location: '台北市大安區',
        scheduled_start: '2026-05-01T08:00:00Z',
        scheduled_end: '2026-05-01T12:00:00Z',
        pilot_id: 'pilot-001',
        equipment_ids: ['eq-001'],
        permit_obtained: true,
        service_fee: 50000,    // >= NT$20,000 觸發協作門檻
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('mission_id');
  });

  it('POST /agents/scout/collab/lex → triggers fee threshold validation (< 20000 → 400)', async () => {
    // First create a mission with low fee
    const create = await request(app)
      .post('/agents/scout/mission')
      .send({
        mission_type: 'inspection',
        title: '低金額測試任務',
        client_name: '小客戶',
        location: '新北市',
        scheduled_start: '2026-06-01T08:00:00Z',
        scheduled_end: '2026-06-01T10:00:00Z',
        pilot_id: 'pilot-002',
        equipment_ids: [],
        permit_obtained: false,
        service_fee: 5000,   // < NT$20,000 → 應被拒絕
      });
    expect(create.status).toBe(201);
    const missionId = create.body.mission_id as string;

    const collab = await request(app)
      .post('/agents/scout/collab/lex')
      .send({ mission_id: missionId });
    expect(collab.status).toBe(400);
    expect(collab.body.error).toMatch(/20,000|20000/);
  });
});

// ═══════════════════════════════════════════════════════════════
// § C-1b: Guardian → Accountant 協作（保費自動記帳）
// ═══════════════════════════════════════════════════════════════

describe('C-1b: Guardian → Accountant Collaboration', () => {
  it('POST /agents/guardian/collab/accountant → 200 with ok:true', async () => {
    const res = await request(app)
      .post('/agents/guardian/collab/accountant')
      .send({ entity_type: 'co_construction', year: 2026, purpose: '整合測試' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.source).toBe('accountant');
    expect(res.body.data).toBeDefined();
  });

  it('POST /agents/guardian/collab/accountant → 200 without optional params', async () => {
    const res = await request(app)
      .post('/agents/guardian/collab/accountant')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveProperty('income');
    expect(res.body.data).toHaveProperty('expense');
    expect(res.body.data).toHaveProperty('net');
  });

  it('POST /agents/guardian/collab/auto-booking → 400 when policy_id missing', async () => {
    const res = await request(app)
      .post('/agents/guardian/collab/auto-booking')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /agents/guardian/collab/auto-booking → 404 when policy not found', async () => {
    const res = await request(app)
      .post('/agents/guardian/collab/auto-booking')
      .send({ policy_id: 'nonexistent-policy-999' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('POST /agents/guardian/policy + collab/auto-booking flow → should book premium', async () => {
    // Step 1: 先登錄一張保單（annual_premium >= 5000）
    const policyRes = await request(app)
      .post('/agents/guardian/policy')
      .send({
        entity_type:    'co_construction',
        category:       'workers_comp',
        insurer:        '國泰產險',
        insured_name:   '王大明',
        sum_insured:    5000000,
        annual_premium: 24000,       // >= NT$5,000 門檻
        start_date:     '2026-01-01',
        policy_no:      'KC123456789',
        payment_frequency: 'annual',
      });
    expect(policyRes.status).toBe(201);
    const policyId = policyRes.body.policy_id as string;
    expect(policyId).toBeDefined();

    // Step 2: 觸發自動入帳
    const collabRes = await request(app)
      .post('/agents/guardian/collab/auto-booking')
      .send({ policy_id: policyId });
    expect(collabRes.status).toBe(200);
    expect(collabRes.body.ok).toBe(true);
    expect(collabRes.body.request_ids).toBeDefined();
    expect(collabRes.body.status).toBeDefined();
  });

  it('POST /agents/guardian/collab/auto-booking → 400 when premium < 5000', async () => {
    // 建立低保費保單
    const policyRes = await request(app)
      .post('/agents/guardian/policy')
      .send({
        entity_type:    'personal',
        category:       'accident',
        insurer:        '富邦產險',
        insured_name:   '測試人',
        sum_insured:    100000,
        annual_premium: 3000,         // < NT$5,000 → 拒絕
        start_date:     '2026-01-01',
        policy_no:      'FB000000001',
        payment_frequency: 'annual',
      });
    expect(policyRes.status).toBe(201);
    const policyId = policyRes.body.policy_id as string;

    const collabRes = await request(app)
      .post('/agents/guardian/collab/auto-booking')
      .send({ policy_id: policyId });
    expect(collabRes.status).toBe(400);
    expect(collabRes.body.error).toMatch(/5,000|5000/);
  });
});

// ═══════════════════════════════════════════════════════════════
// § C-1d: Accountant ↔ Finance 對帳（Reconcile 路由）
// ═══════════════════════════════════════════════════════════════

describe('C-1d: Reconciliation Routes (/system/reconcile)', () => {
  it('GET /system/reconcile → 200 with ok:true', async () => {
    const res = await request(app).get('/system/reconcile');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body).toHaveProperty('overall_status');
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /system/reconcile?period=202601 → 200 with period filter', async () => {
    const res = await request(app).get('/system/reconcile?period=202601');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body).toHaveProperty('period');
    expect(res.body).toHaveProperty('total_delta');
    expect(res.body).toHaveProperty('action_items');
  });

  it('GET /system/reconcile?entity_type=personal → 200', async () => {
    const res = await request(app).get('/system/reconcile?entity_type=personal');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /system/reconcile → 200 manual trigger without persist', async () => {
    const res = await request(app)
      .post('/system/reconcile')
      .send({ period: '202601', entity_type: 'co_construction', persist: false });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.persisted).toBe(false);
    expect(res.body).toHaveProperty('overall_status');
    expect(res.body).toHaveProperty('executed_at');
  });

  it('GET /system/reconcile/summary → 200 with badge fields', async () => {
    const res = await request(app).get('/system/reconcile/summary');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body).toHaveProperty('overall_status');
    expect(res.body).toHaveProperty('matched_count');
    expect(res.body).toHaveProperty('issue_count');
    expect(res.body).toHaveProperty('total_delta');
    expect(res.body).toHaveProperty('top_actions');
    expect(Array.isArray(res.body.top_actions)).toBe(true);
  });

  it('GET /system/reconcile — disclaimer always present', async () => {
    const res = await request(app).get('/system/reconcile');
    expect(res.body._disclaimer).toBeDefined();
    expect(typeof res.body._disclaimer).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════
// § E-3: Sage Analytics Agent
// ═══════════════════════════════════════════════════════════════

describe('E-3: Sage Agent Routes', () => {
  it('GET /agents/sage/health → 200 with status online', async () => {
    const res = await request(app).get('/agents/sage/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('online');
    expect(res.body.agent).toBe('sage');
    expect(res.body.timestamp).toBeDefined();
  });

  it('POST /agents/sage/chat → 400 when message missing', async () => {
    const res = await request(app)
      .post('/agents/sage/chat')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /agents/sage/chat → 400 when body is empty', async () => {
    const res = await request(app)
      .post('/agents/sage/chat')
      .send({ data_context: 'some data but no message' });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// § D-5: System Agent Bus + AI Cost Dashboard
// ═══════════════════════════════════════════════════════════════

describe('D-5: System Monitoring Routes', () => {
  it('GET /system/agent-bus → 200 with summary + agents', async () => {
    const res = await request(app).get('/system/agent-bus');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('agents');
    expect(Array.isArray(res.body.agents)).toBe(true);
    // Summary 欄位
    expect(res.body.summary).toHaveProperty('total');
    expect(res.body.summary).toHaveProperty('online');
    expect(res.body.summary).toHaveProperty('offline');
    expect(res.body.summary).toHaveProperty('polled_at');
  });

  it('GET /system/agent-bus → includes write_request_queue stats', async () => {
    const res = await request(app).get('/system/agent-bus');
    expect(res.body).toHaveProperty('write_request_queue');
    const wrq = res.body.write_request_queue;
    expect(wrq).toHaveProperty('queued');
    expect(wrq).toHaveProperty('dead_letters');
    expect(wrq).toHaveProperty('processed_keys');
  });

  it('GET /system/agent-bus/history → 200 with total + history array', async () => {
    const res = await request(app).get('/system/agent-bus/history');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('history');
    expect(Array.isArray(res.body.history)).toBe(true);
  });

  it('GET /system/ai-cost → 200 with cost tracking data', async () => {
    const res = await request(app).get('/system/ai-cost');
    expect(res.status).toBe(200);
    // AI Cost tracker should return some structured data
    expect(res.body).toBeDefined();
  });

  it('GET /system/health → 200 with local + cloud status', async () => {
    const res = await request(app).get('/system/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('local');
    expect(res.body).toHaveProperty('cloud');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /system/models → 200 with local + cloud model lists', async () => {
    const res = await request(app).get('/system/models');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('local');
    expect(res.body).toHaveProperty('cloud');
    expect(Array.isArray(res.body.cloud.models)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// § Route Existence Coverage (Cross-Agent)
// ═══════════════════════════════════════════════════════════════

describe('Collab Route Existence (no 404)', () => {
  const routes: [string, string][] = [
    ['GET',  '/agents/scout/health'],
    ['GET',  '/agents/guardian/health'],
    ['GET',  '/agents/sage/health'],
    ['GET',  '/system/reconcile'],
    ['GET',  '/system/reconcile/summary'],
    ['GET',  '/system/agent-bus'],
    ['GET',  '/system/agent-bus/history'],
    ['GET',  '/system/ai-cost'],
    ['GET',  '/system/health'],
    ['GET',  '/system/models'],
  ];

  for (const [method, path] of routes) {
    it(`${method} ${path} should not return 404`, async () => {
      const res = method === 'GET'
        ? await request(app).get(path)
        : await request(app).post(path).send({});
      expect(res.status).not.toBe(404);
    });
  }
});
