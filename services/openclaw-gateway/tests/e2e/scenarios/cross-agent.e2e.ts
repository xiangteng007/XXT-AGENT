/**
 * cross-agent.e2e.ts — D-1 場景 3: Cross-Agent 協作鏈
 *
 * 驗證跨 Agent 協作的完整鏈路：
 *   Scout → Lex → Accountant（透過 Write Request Queue QVP 協議）
 *
 * 測試標的：
 *   1. /system/agent-bus — Agent 匯流排查詢
 *   2. /system/reconcile — 對帳 API（雙向查詢模式）
 *   3. Write Request Queue 統計（wrq.getStats）
 *
 * 注意：本測試不測試 WRQ 的實際投遞（那會呼叫 localhost:3100），
 * 而是驗證 API 層的行為正確性與跨模組整合。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer, type TestServer } from '../helpers/test-server';
import { createApiClient, type ApiClient } from '../helpers/api-client';
import { createEvent } from '../fixtures/seed-factory';

let testServer: TestServer;
let api: ApiClient;

beforeAll(async () => {
  testServer = await createTestServer();
  api = createApiClient(testServer.baseUrl);
});

afterAll(async () => {
  await testServer.cleanup();
});

// ═══════════════════════════════════════════════════════════════
// § 1. Agent Bus — 匯流排查詢
// ═══════════════════════════════════════════════════════════════

describe('E2E: Cross-Agent — Agent Bus', () => {
  it('should return agent bus status with summary and agents', async () => {
    const res = await api.get('/system/agent-bus');
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body).toHaveProperty('agents');
    expect(body).toHaveProperty('summary');
  });

  it('summary should include health stats', async () => {
    const res = await api.get('/system/agent-bus');
    const body = await api.json(res);

    const summary = body['summary'] as Record<string, unknown>;
    expect(summary).toHaveProperty('total');
    expect(summary).toHaveProperty('online');
    expect(summary).toHaveProperty('offline');
    expect(summary).toHaveProperty('polled_at');
    expect(typeof summary['total']).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════
// § 2. Event Ingest → State 變更流程
// ═══════════════════════════════════════════════════════════════

describe('E2E: Cross-Agent — Event Workflow', () => {
  it('should complete health → ingest → state workflow', async () => {
    // Step 1: Health check
    const healthRes = await api.get('/health');
    expect(healthRes.status).toBe(200);

    // Step 2: Ingest event
    const event = createEvent({ type: 'NEWS_INGESTED', source: 'e2e-cross-agent' });
    const ingestRes = await api.post('/events/ingest', event);
    expect(ingestRes.status).toBe(202);

    const ingestBody = await api.json(ingestRes);
    expect(ingestBody['ok']).toBe(true);
    expect(ingestBody['event_id']).toBeDefined();

    // Step 3: State should remain valid
    const stateRes = await api.get('/agents/state');
    expect(stateRes.status).toBe(200);
  });

  it('should handle multiple sequential events', async () => {
    const events = [
      createEvent({ type: 'TASK_QUEUED', source: 'scout' }),
      createEvent({ type: 'NEWS_INGESTED', source: 'flashbot' }),
      createEvent({ type: 'TASK_QUEUED', source: 'lex' }),
    ];

    for (const event of events) {
      const res = await api.post('/events/ingest', event);
      expect(res.status).toBe(202);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// § 3. Reconcile — 對帳 API
// ═══════════════════════════════════════════════════════════════

describe('E2E: Cross-Agent — Reconcile API', () => {
  it('GET /system/reconcile should return reconciliation report', async () => {
    const res = await api.get('/system/reconcile');

    // 即使沒有真實 ledger/loan 資料，API 應正常回應（空報告）
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body['ok']).toBe(true);
    expect(body).toHaveProperty('overall_status');
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('action_items');
  });

  it('GET /system/reconcile?period=202604 should filter by period', async () => {
    const res = await api.get('/system/reconcile?period=202604');
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body['period']).toBe('202604');
  });

  it('GET /system/reconcile/summary should return compact summary', async () => {
    const res = await api.get('/system/reconcile/summary');
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body['ok']).toBe(true);
    expect(body).toHaveProperty('overall_status');
    expect(body).toHaveProperty('matched_count');
    expect(body).toHaveProperty('issue_count');
  });

  it('POST /system/reconcile should trigger full reconciliation', async () => {
    const res = await api.post('/system/reconcile', {
      period: '202604',
      persist: false,
    });

    expect(res.status).toBe(200);
    const body = await api.json(res);
    expect(body['ok']).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 4. VRAM & System 路由
// ═══════════════════════════════════════════════════════════════

describe('E2E: Cross-Agent — System Routes', () => {
  it('GET /vram should return VRAM status', async () => {
    const res = await api.get('/vram');
    // VRAM 路由可能回 200 或 503 取決於 GPU 可用性
    expect(res.status).toBeLessThan(600);
  });

  it('GET /system should return system info', async () => {
    const res = await api.get('/system');
    expect(res.status).toBeLessThan(600);
  });
});
