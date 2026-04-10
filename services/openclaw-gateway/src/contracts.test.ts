/**
 * contracts.test.ts — T-04: API 回應格式合約測試
 *
 * 目的：確保各端點的回應 JSON 形狀（contract）不會在重構中被破壞。
 * 不測試業務邏輯，只驗證回應格式符合前端的預期合約。
 *
 * 測試對象：
 *   1. /health — 狀態端點合約
 *   2. /events/ingest — 事件注入合約
 *   3. /agents/state — Agent 狀態合約
 *   4. 404 — 錯誤回應合約
 *   5. Error handler 格式合約
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

process.env['DEV_BYPASS_AUTH'] = 'true';
process.env['NODE_ENV'] = 'test';

let app: import('express').Express;

beforeAll(async () => {
  const mod = await import('./app');
  app = mod.app;
});

// ═══════════════════════════════════════════════════════════════
// § 1. Health Contract
// ═══════════════════════════════════════════════════════════════

describe('Contract: GET /health', () => {
  it('should conform to HealthResponse contract', async () => {
    const res = await request(app).get('/health');
    const body = res.body;

    // Required fields
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('deploy_mode');
    expect(body).toHaveProperty('local_runner');
    expect(body).toHaveProperty('server_time');
    expect(body).toHaveProperty('rate_limit_stats');

    // Type checks
    expect(typeof body.status).toBe('string');
    expect(typeof body.deploy_mode).toBe('string');
    expect(typeof body.server_time).toBe('string');
    expect(typeof body.local_runner).toBe('object');

    // server_time should be valid ISO string
    expect(new Date(body.server_time).toISOString()).toBe(body.server_time);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 2. Event Ingest Contract
// ═══════════════════════════════════════════════════════════════

describe('Contract: POST /events/ingest', () => {
  it('success response should conform to {ok, event_id}', async () => {
    const res = await request(app)
      .post('/events/ingest')
      .send({ type: 'TASK_QUEUED', source: 'contract-test' });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      ok: true,
    });
    expect(typeof res.body.event_id).toBe('string');
    // event_id should be a valid UUID
    expect(res.body.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('error response should conform to {error: string}', async () => {
    const res = await request(app)
      .post('/events/ingest')
      .send({});

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════
// § 3. Agent State Contract
// ═══════════════════════════════════════════════════════════════

describe('Contract: GET /agents/state', () => {
  it('should conform to {agents: Agent[], runtime: object}', async () => {
    const res = await request(app).get('/agents/state');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body).toHaveProperty('runtime');

    // Each agent should have minimum required fields
    if (res.body.agents.length > 0) {
      const agent = res.body.agents[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(typeof agent.id).toBe('string');
      expect(typeof agent.name).toBe('string');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// § 4. Error Response Contract (404/5xx)
// ═══════════════════════════════════════════════════════════════

describe('Contract: Error responses', () => {
  it('404 should conform to {ok, code, message, request_id}', async () => {
    const res = await request(app).get('/absolutely-nonexistent');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
    expect(typeof res.body.message).toBe('string');
    expect(typeof res.body.request_id).toBe('string');
  });

  it('error response should NOT expose stack in production shape', async () => {
    // 404 responses should never have stack traces
    const res = await request(app).get('/no-such-path');
    expect(res.body.stack).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// § 5. Response Headers Contract
// ═══════════════════════════════════════════════════════════════

describe('Contract: Response headers', () => {
  it('all responses should include X-Request-ID', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('all responses should include security headers', async () => {
    const res = await request(app).get('/health');
    // Helmet headers
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('CORS allowed-methods should match supported verbs', async () => {
    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:3000');

    const methods = res.headers['access-control-allow-methods'];
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('PATCH');
    expect(methods).toContain('DELETE');
  });
});
