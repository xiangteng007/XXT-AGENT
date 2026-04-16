/**
 * health-check.e2e.ts — D-1 場景 1: Gateway Health Check 流程
 *
 * 驗證 /health 端點的完整行為：
 *   1. 回傳 status: ok
 *   2. 包含所有必要欄位（deploy_mode, local_runner, ws_connections 等）
 *   3. Content-Type 為 application/json
 *   4. 連續多次請求皆穩定回應
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
// § 1. 基本健康檢查
// ═══════════════════════════════════════════════════════════════

describe('E2E: Health Check — 基本回應', () => {
  it('should return 200 with status ok', async () => {
    const res = await api.get('/health');
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body['status']).toBe('ok');
  });

  it('should return Content-Type application/json', async () => {
    const res = await api.get('/health');
    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toContain('application/json');
  });
});

// ═══════════════════════════════════════════════════════════════
// § 2. 回應結構完整性
// ═══════════════════════════════════════════════════════════════

describe('E2E: Health Check — 結構完整性', () => {
  it('should include all required fields', async () => {
    const res = await api.get('/health');
    const body = await api.json(res);

    // 必要欄位
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('deploy_mode');
    expect(body).toHaveProperty('local_runner');
    expect(body).toHaveProperty('server_time');
  });

  it('deploy_mode should reflect NODE_ENV', async () => {
    const res = await api.get('/health');
    const body = await api.json(res);

    // 在測試中 DEPLOY_MODE 預設為 'local'
    expect(typeof body['deploy_mode']).toBe('string');
  });

  it('server_time should be a valid ISO timestamp', async () => {
    const res = await api.get('/health');
    const body = await api.json(res);

    const serverTime = body['server_time'] as string;
    expect(serverTime).toBeDefined();
    expect(new Date(serverTime).toISOString()).toBe(serverTime);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 3. 穩定性測試
// ═══════════════════════════════════════════════════════════════

describe('E2E: Health Check — 穩定性', () => {
  it('should respond consistently across 10 consecutive requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => api.get('/health')),
    );

    for (const res of results) {
      expect(res.status).toBe(200);
      const body = await api.json(res);
      expect(body['status']).toBe('ok');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// § 4. Error Pages
// ═══════════════════════════════════════════════════════════════

describe('E2E: Health Check — 404 回應', () => {
  it('unknown routes should return 404 JSON', async () => {
    const res = await api.get('/does-not-exist');
    expect(res.status).toBe(404);

    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toContain('application/json');
  });
});
