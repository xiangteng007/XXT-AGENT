/**
 * guardian.e2e.ts — D-1: Guardian (安盾) 端到端測試
 * 
 * 驗證 Guardian 功能：
 *   1. 建立月繳保單並執行 /collab/auto-booking 產生分期記錄
 *   2. 執行 /report/premium 確認實體別對帳
 *   3. 執行 /report/gap 確認缺口分析與 AI 建議內容
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

describe('E2E: Guardian — Auto Booking', () => {
  let createdPolicyId: string;

  it('should create a monthly payment policy', async () => {
    const res = await api.post('/agents/guardian/policy', {
      entity_type: 'personal',
      category: 'medical',
      insurer: '富邦產險',
      insured_name: '測試人員',
      sum_insured: 1000000,
      annual_premium: 12000,
      start_date: '2026-05-01',
      payment_frequency: 'monthly',
      policy_no_masked: '1234'
    });

    expect(res.status).toBe(201);
    const body = await api.json(res);
    expect(body['ok']).toBe(true);
    expect(body['policy_id']).toBeDefined();
    createdPolicyId = body['policy_id'] as string;
  });

  it('should auto-book 12 installments for monthly policy', async () => {
    expect(createdPolicyId).toBeDefined();

    const res = await api.post('/agents/guardian/collab/auto-booking', {
      policy_id: createdPolicyId
    });

    expect(res.status).toBe(200);
    const body = await api.json(res);
    expect(body['ok']).toBe(true);
    expect(body['installments_created']).toBe(12);
    expect(Array.isArray(body['request_ids'])).toBe(true);
    expect((body['request_ids'] as any[]).length).toBe(12);
  });

  it('should fail auto-booking if premium < 5000', async () => {
    const resLow = await api.post('/agents/guardian/policy', {
      entity_type: 'personal',
      category: 'medical',
      insurer: '富邦產險',
      insured_name: '測試人員',
      sum_insured: 1000000,
      annual_premium: 4999,
      start_date: '2026-05-01'
    });
    const lowPolicyId = (await api.json(resLow))['policy_id'];

    const res = await api.post('/agents/guardian/collab/auto-booking', {
      policy_id: lowPolicyId
    });
    expect(res.status).toBe(400);
    const body = await api.json(res);
    expect(body['error']).toContain('>= NT$5,000');
  });

  it('should fail auto-booking if policy_id is missing', async () => {
    const res = await api.post('/agents/guardian/collab/auto-booking', {});
    expect(res.status).toBe(400);
    const body = await api.json(res);
    expect(body['error']).toBe('policy_id is required');
  });

  it('should fail auto-booking if policy_id is invalid/not found', async () => {
    const res = await api.post('/agents/guardian/collab/auto-booking', {
      policy_id: 'non-existent-uuid-1234'
    });
    expect(res.status).toBe(404);
    const body = await api.json(res);
    expect(body['error']).toBe('Policy not found');
  });
});

describe('E2E: Guardian — Chat', () => {
  it('should fail if message is missing', async () => {
    const res = await api.post('/agents/guardian/chat', { context: 'test' });
    expect(res.status).toBe(400);
    const body = await api.json(res);
    expect(body['error']).toBe('message required');
  });
});

describe('E2E: Guardian — Premium Report', () => {
  it('should return entity-level reconciliation', async () => {
    const res = await api.get('/agents/guardian/report/premium');
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body['ok']).toBe(true);
    expect(body).toHaveProperty('registered_in_guardian');
    expect(body).toHaveProperty('ledger_insurance');
    expect(body).toHaveProperty('reconciliation');

    const recon = body['reconciliation'] as Record<string, any>;
    expect(recon).toHaveProperty('status');
    expect(recon).toHaveProperty('breakdown');
    expect(Array.isArray(recon['breakdown'])).toBe(true);
  });
});

describe('E2E: Guardian — Gap Report', () => {
  it('should return gap analysis and AI advice structure', async () => {
    const res = await api.get('/agents/guardian/report/gap');
    expect(res.status).toBe(200);

    const body = await api.json(res);
    expect(body['ok']).toBe(true);
    expect(body).toHaveProperty('overall_score');
    expect(body).toHaveProperty('gap_summary');
    expect(body).toHaveProperty('gap_details');
    expect(body).toHaveProperty('qualitative_advice');
    
    // As mock-ollama will fail to connect, we expect the fallback string
    expect(body['qualitative_advice']).toBeDefined();
    // Verify that action items are correctly structured
    expect(Array.isArray(body['action_items'])).toBe(true);
  });
});
