/**
 * reconcile.e2e.ts — D-1 場景 4: /system/reconcile 全流程
 *
 * 深入驗證對帳引擎的行為：
 *   1. 空資料時的 MATCHED 回應
 *   2. 有 entity_type 篩選的對帳
 *   3. POST 觸發對帳（含 persist=true/false）
 *   4. Summary 端點的欄位完整性
 *   5. 錯誤輸入的容錯能力
 *
 * 注意：對帳引擎內部會透過 fetch 呼叫
 *   - GET /agents/accountant/ledger
 *   - GET /agents/finance/loan
 * 在測試中這些呼叫會因為 Gateway 未自我連線而返回空資料，
 * 但 API 層不應 crash。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer, type TestServer } from '../helpers/test-server';
import { createApiClient, type ApiClient } from '../helpers/api-client';

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
// § 1. GET 對帳
// ═══════════════════════════════════════════════════════════════

describe('E2E: Reconcile — GET 查詢模式', () => {
  it('should return MATCHED when no data exists', async () => {
    const res = await api.get('/system/reconcile');
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body['ok']).toBe(true);
    // 空資料 = 沒有任何 discrepancy = MATCHED
    expect(body['overall_status']).toBe('MATCHED');
    expect(body['total_delta']).toBe(0);
    expect(body['ledger_total']).toBe(0);
    expect(body['loan_total']).toBe(0);
  });

  it('should accept period parameter', async () => {
    const res = await api.get('/system/reconcile?period=202604');
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body['period']).toBe('202604');
  });

  it('should accept entity_type parameter', async () => {
    const res = await api.get('/system/reconcile?entity_type=co_senteng');
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body['ok']).toBe(true);
  });

  it('should accept combined parameters', async () => {
    const res = await api.get('/system/reconcile?period=202604&entity_type=co_senteng');
    expect(res.status).toBe(200);
  });

  it('should include disclaimer in response', async () => {
    const res = await api.get('/system/reconcile');
    const body = await api.json(res);
    expect(body['_disclaimer']).toBeDefined();
    expect(body['_disclaimer']).toContain('對帳');
  });
});

// ═══════════════════════════════════════════════════════════════
// § 2. POST 對帳
// ═══════════════════════════════════════════════════════════════

describe('E2E: Reconcile — POST 手動觸發', () => {
  it('should accept POST with empty body', async () => {
    const res = await api.post('/system/reconcile', {});
    expect(res.status).toBe(200);
  });

  it('should accept POST with period and entity_type', async () => {
    const res = await api.post('/system/reconcile', {
      period: '202604',
      entity_type: 'co_senteng',
      persist: false,
    });
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body['ok']).toBe(true);
    expect(body['persisted']).toBe(false);
  });

  it('POST with persist=true should not crash (Firestore may not be available)', async () => {
    const res = await api.post('/system/reconcile', {
      period: '202604',
      persist: true,
    });

    // 即使 Firestore 不可用，也不應 500
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 3. Summary 端點
// ═══════════════════════════════════════════════════════════════

describe('E2E: Reconcile — Summary', () => {
  it('should return compact summary fields', async () => {
    const res = await api.get('/system/reconcile/summary');
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body['ok']).toBe(true);

    // Summary 特有欄位
    expect(body).toHaveProperty('overall_status');
    expect(body).toHaveProperty('matched_count');
    expect(body).toHaveProperty('issue_count');
    expect(body).toHaveProperty('total_delta');
    expect(body).toHaveProperty('ledger_total');
    expect(body).toHaveProperty('loan_total');
    expect(body).toHaveProperty('executed_at');
    expect(typeof body['matched_count']).toBe('number');
    expect(typeof body['issue_count']).toBe('number');
  });

  it('should return top 3 action items at most', async () => {
    const res = await api.get('/system/reconcile/summary');
    const body = await api.json(res);

    const topActions = body['top_actions'] as unknown[];
    expect(Array.isArray(topActions)).toBe(true);
    expect(topActions.length).toBeLessThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 4. 報告結構一致性
// ═══════════════════════════════════════════════════════════════

describe('E2E: Reconcile — 結構一致性', () => {
  it('GET and POST should return same structure', async () => {
    const getRes = await api.get('/system/reconcile?period=202604');
    const postRes = await api.post('/system/reconcile', { period: '202604' });

    const getBody = await api.json(getRes);
    const postBody = await api.json(postRes);

    // 共有欄位應一致
    expect(getBody['overall_status']).toBe(postBody['overall_status']);
    expect(getBody['ledger_total']).toBe(postBody['ledger_total']);
    expect(getBody['loan_total']).toBe(postBody['loan_total']);
  });
});
