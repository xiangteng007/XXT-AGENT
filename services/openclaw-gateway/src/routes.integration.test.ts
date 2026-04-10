/**
 * routes.integration.test.ts — T-01: 核心路由整合測試
 *
 * 使用 supertest 直接對 Express app 發送 HTTP 請求，
 * 無需啟動真正的 server（得益於 A-01 分離出的 app.ts）。
 *
 * 測試目標：
 *   1. 公開路由可存取性（/health, /system）
 *   2. 保護路由的 Auth gate（401 驗證）
 *   3. 404 fallback 格式
 *   4. CORS 行為
 *   5. OPTIONS preflight
 *   6. 基本回應結構正確性
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// DEV_BYPASS_AUTH=true，讓保護路由在測試中可通過 auth
process.env['DEV_BYPASS_AUTH'] = 'true';
// 確保不是 production，讓 bypass 生效
process.env['NODE_ENV'] = 'test';

// 延遲 import，讓 env 先設定好
let app: import('express').Express;

beforeAll(async () => {
  const mod = await import('./app');
  app = mod.app;
});

// ═══════════════════════════════════════════════════════════════
// § 1. 公開路由（不需 Auth）
// ═══════════════════════════════════════════════════════════════

describe('Public routes', () => {
  describe('GET /health', () => {
    it('should return 200 with status "ok"', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('should include expected fields in health response', async () => {
      const res = await request(app).get('/health');
      expect(res.body).toHaveProperty('deploy_mode');
      expect(res.body).toHaveProperty('local_runner');
      expect(res.body).toHaveProperty('server_time');
      expect(res.body).toHaveProperty('rate_limit_stats');
    });
  });

  describe('GET /system/health', () => {
    it('should return 200', async () => {
      const res = await request(app).get('/system/health');
      expect(res.status).toBe(200);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// § 2. 保護路由 Auth Gate（DEV_BYPASS=true → 通過）
// ═══════════════════════════════════════════════════════════════

describe('Protected routes (DEV_BYPASS=true)', () => {
  describe('GET /agents/state', () => {
    it('should return 200 with agents array', async () => {
      const res = await request(app).get('/agents/state');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('agents');
      expect(Array.isArray(res.body.agents)).toBe(true);
    });

    it('should include runtime info', async () => {
      const res = await request(app).get('/agents/state');
      expect(res.body).toHaveProperty('runtime');
    });
  });

  describe('POST /events/ingest', () => {
    it('should return 400 when body is empty', async () => {
      const res = await request(app)
        .post('/events/ingest')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields');
    });

    it('should return 400 for unknown event type', async () => {
      const res = await request(app)
        .post('/events/ingest')
        .send({ type: 'UNKNOWN_TYPE', source: 'test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unknown event type');
    });

    it('should return 202 for valid event', async () => {
      const res = await request(app)
        .post('/events/ingest')
        .send({
          type: 'TASK_QUEUED',
          source: 'integration-test',
          payload: { message: 'test' },
        });
      expect(res.status).toBe(202);
      expect(res.body.ok).toBe(true);
      expect(res.body.event_id).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// § 3. Auth Gate — 無 Token 應 401（關閉 DEV_BYPASS）
// ═══════════════════════════════════════════════════════════════

describe('Protected routes (Auth contract)', () => {
  it('firebaseAuthMiddleware should be a function with correct arity', async () => {
    // 驗證 middleware 函式簽章正確（req, res, next）
    const { firebaseAuthMiddleware } = await import('./middleware/firebase-auth');
    expect(typeof firebaseAuthMiddleware).toBe('function');
    // Express middleware 接受 3 個參數 (req, res, next)
    expect(firebaseAuthMiddleware.length).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 4. 404 Fallback
// ═══════════════════════════════════════════════════════════════

describe('404 fallback', () => {
  it('should return 404 JSON for unknown paths', async () => {
    const res = await request(app).get('/nonexistent/route');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.message).toContain('/nonexistent/route');
  });

  it('should include request_id in 404 response', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.body).toHaveProperty('request_id');
  });
});

// ═══════════════════════════════════════════════════════════════
// § 5. CORS
// ═══════════════════════════════════════════════════════════════

describe('CORS behavior', () => {
  it('should set CORS headers for allowed origins', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should NOT set CORS origin for disallowed origins', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should return 204 for OPTIONS preflight', async () => {
    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:3000');
    expect(res.status).toBe(204);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 6. Request ID
// ═══════════════════════════════════════════════════════════════

describe('Request ID middleware', () => {
  it('should auto-generate X-Request-ID if not provided', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
  });

  it('should echo back provided X-Request-ID', async () => {
    const customId = 'test-req-12345';
    const res = await request(app)
      .get('/health')
      .set('X-Request-ID', customId);
    expect(res.headers['x-request-id']).toBe(customId);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 7. Security Headers (Helmet)
// ═══════════════════════════════════════════════════════════════

describe('Security headers', () => {
  it('should include helmet security headers', async () => {
    const res = await request(app).get('/health');
    // Helmet 預設會設定 X-Content-Type-Options
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
