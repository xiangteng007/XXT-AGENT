/**
 * e2e.test.ts — T-02: End-to-End 測試框架
 *
 * 與 routes.integration.test.ts 使用 supertest（不啟動真實 server）不同，
 * 本測試啟動一個真正的 HTTP server，驗證完整的請求生命週期。
 *
 * 測試對象：
 *   1. 真實 HTTP request/response 循環
 *   2. Server 啟動/關閉正確性
 *   3. 跨路由請求流程（event ingest → state 變更）
 *   4. Content-Type 正確性
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'http';

process.env['DEV_BYPASS_AUTH'] = 'true';
process.env['NODE_ENV'] = 'test';

let server: http.Server;
let baseUrl: string;

/**
 * 封裝 fetch 呼叫（使用 Node.js 18+ 原生 fetch）
 */
async function api(path: string, options?: RequestInit) {
  return fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
}

beforeAll(async () => {
  const { app } = await import('./app');
  server = http.createServer(app);

  await new Promise<void>((resolve) => {
    // 使用隨機 port 避免與開發 server 衝突
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

// ═══════════════════════════════════════════════════════════════
// § 1. Server 啟動驗證
// ═══════════════════════════════════════════════════════════════

describe('E2E: Server lifecycle', () => {
  it('server should be listening on assigned port', () => {
    expect(baseUrl).toBeDefined();
    expect(baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it('should respond to health check via real HTTP', async () => {
    const res = await api('/health');
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe('ok');
  });
});

// ═══════════════════════════════════════════════════════════════
// § 2. 完整請求生命週期
// ═══════════════════════════════════════════════════════════════

describe('E2E: Full request lifecycle', () => {
  it('should ingest event and return valid event_id', async () => {
    const res = await api('/events/ingest', {
      method: 'POST',
      body: JSON.stringify({
        type: 'TASK_QUEUED',
        source: 'e2e-test',
        payload: { message: 'E2E test event' },
      }),
    });

    expect(res.status).toBe(202);
    const body = await res.json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.event_id).toBeDefined();
  });

  it('should retrieve agent state', async () => {
    const res = await api('/agents/state');
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body.agents)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 3. Content-Type 驗證
// ═══════════════════════════════════════════════════════════════

describe('E2E: Content-Type', () => {
  it('JSON endpoints should return application/json', async () => {
    const res = await api('/health');
    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toContain('application/json');
  });

  it('404 should also return application/json', async () => {
    const res = await api('/nonexistent-e2e');
    expect(res.status).toBe(404);
    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toContain('application/json');
  });
});

// ═══════════════════════════════════════════════════════════════
// § 4. 跨端點工作流程
// ═══════════════════════════════════════════════════════════════

describe('E2E: Cross-endpoint workflow', () => {
  it('should complete health → ingest → state workflow', async () => {
    // Step 1: Verify server is healthy
    const healthRes = await api('/health');
    expect(healthRes.status).toBe(200);

    // Step 2: Ingest an event
    const ingestRes = await api('/events/ingest', {
      method: 'POST',
      body: JSON.stringify({
        type: 'NEWS_INGESTED',
        source: 'e2e-workflow-test',
        payload: { title: 'E2E workflow test news' },
      }),
    });
    expect(ingestRes.status).toBe(202);

    // Step 3: State should still be valid
    const stateRes = await api('/agents/state');
    expect(stateRes.status).toBe(200);

    const state = await stateRes.json() as Record<string, unknown>;
    expect(state.agents).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// § 5. Error handling — E2E
// ═══════════════════════════════════════════════════════════════

describe('E2E: Error handling', () => {
  it('invalid JSON body should not crash server', async () => {
    const res = await fetch(`${baseUrl}/events/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });

    // Server should respond (not crash)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('server should remain responsive after error', async () => {
    // Send invalid request
    await fetch(`${baseUrl}/events/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad}',
    });

    // Server should still work
    const healthRes = await api('/health');
    expect(healthRes.status).toBe(200);
  });
});
