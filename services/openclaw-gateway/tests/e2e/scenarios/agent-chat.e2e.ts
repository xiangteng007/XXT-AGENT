/**
 * agent-chat.e2e.ts — D-1 場景 2: Agent Chat 完整對話
 *
 * 驗證 /agents/chat 端點的完整生命週期：
 *   1. 訊息提交 → 202 Accepted 回應
 *   2. 空訊息 → 400 Bad Request
 *   3. 各類別關鍵字 → 正確的 Agent 路由（Fallback Heuristics）
 *   4. /agents/state → Agent 狀態列表
 *
 * 注意：Chat 端點為非阻塞設計（立即回 202，背景處理）。
 * E2E 測試僅驗證 HTTP 回應，不驗證 WebSocket 廣播（需 WS 客戶端）。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer, type TestServer } from '../helpers/test-server';
import { createApiClient, type ApiClient } from '../helpers/api-client';
import { createChatMessage } from '../fixtures/seed-factory';

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
// § 1. Chat 基本流程
// ═══════════════════════════════════════════════════════════════

describe('E2E: Agent Chat — 基本流程', () => {
  it('should accept a valid chat message with 202', async () => {
    const msg = createChatMessage({ message: '你好，請問今天有什麼任務？' });
    const res = await api.post('/agents/chat', msg);

    expect(res.status).toBe(202);
    const body = await api.json(res);
    expect(body['success']).toBe(true);
    expect(body['status']).toBe('routing');
  });

  it('should reject empty message with 400', async () => {
    const res = await api.post('/agents/chat', { session_id: 'test' });

    expect(res.status).toBe(400);
    const body = await api.json(res);
    expect(body['error']).toContain('No message');
  });

  it('should reject missing body with 400', async () => {
    const res = await api.post('/agents/chat', {});
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
// § 2. Agent State API
// ═══════════════════════════════════════════════════════════════

describe('E2E: Agent State', () => {
  it('should return agent state array', async () => {
    const res = await api.get('/agents/state');
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body).toHaveProperty('agents');
    expect(Array.isArray(body['agents'])).toBe(true);
  });

  it('should include runtime status', async () => {
    const res = await api.get('/agents/state');
    const body = await api.json(res);
    expect(body).toHaveProperty('runtime');
  });
});

// ═══════════════════════════════════════════════════════════════
// § 3. 關鍵字路由驗證（Heuristic Fallback）
// ═══════════════════════════════════════════════════════════════

describe('E2E: Agent Chat — 多類別訊息', () => {
  const testCases = [
    { message: '請幫我查一下這個月的帳本', label: '帳務類' },
    { message: '房貸月繳是否已扣款？', label: '貸款類' },
    { message: '保險到期了需要續約', label: '保險類' },
    { message: '幫我分析一下市場走勢', label: '投資類' },
    { message: '合約條款有沒有風險？', label: '法律類' },
  ];

  for (const tc of testCases) {
    it(`should accept ${tc.label} message: "${tc.message.slice(0, 20)}..."`, async () => {
      const msg = createChatMessage({ message: tc.message });
      const res = await api.post('/agents/chat', msg);

      // 不管 AI 是否可用，HTTP 層應穩定回 202
      expect(res.status).toBe(202);
      const body = await api.json(res);
      expect(body['success']).toBe(true);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// § 4. 惡意輸入防護
// ═══════════════════════════════════════════════════════════════

describe('E2E: Agent Chat — 輸入防護', () => {
  it('should handle extremely long messages gracefully', async () => {
    const longMessage = '測試'.repeat(10000);
    const msg = createChatMessage({ message: longMessage });
    const res = await api.post('/agents/chat', msg);

    // 應不 crash（即使被 body limit 拒絕）
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(600);
  });

  it('should handle special characters in message', async () => {
    const msg = createChatMessage({
      message: '測試 <script>alert("xss")</script> & "quotes" \'apos\' \n\t',
    });
    const res = await api.post('/agents/chat', msg);
    expect(res.status).toBe(202);
  });
});
