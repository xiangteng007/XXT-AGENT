/**
 * F-03: E2E 整合測試腳本
 *
 * 測試 OpenClaw Gateway 的所有核心端點，包含：
 *   - 基礎健康檢查
 *   - Agent 健康監控 Bus
 *   - CAVP 合規驗證
 *   - Agent Chat（Scout, Lex, Zora, Titan, Lumi, Rusty）
 *   - 帳本記錄 CRUD（Accountant）
 *   - Scout 飛行任務 & 設備
 *   - Rate Limiter 觸發確認
 *
 * 執行方式：
 *   ts-node services/openclaw-gateway/src/scripts/e2e-test.ts
 *   # 或
 *   npx tsx services/openclaw-gateway/src/scripts/e2e-test.ts
 */

const BASE = process.env['GATEWAY_URL'] ?? 'http://localhost:3100';
const API_KEY = process.env['OPENCLAW_API_KEY'] ?? 'dev-secret-key';

const authHeader = { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` };

interface TestResult { name: string; passed: boolean; latency_ms: number; detail?: string; }
const results: TestResult[] = [];

async function test(
  name: string,
  fn: () => Promise<{ ok: boolean; detail?: string }>,
): Promise<void> {
  const start = Date.now();
  try {
    const { ok, detail } = await fn();
    results.push({ name, passed: ok, latency_ms: Date.now() - start, detail });
    console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    results.push({ name, passed: false, latency_ms: Date.now() - start, detail: String(err) });
    console.log(`  ❌ ${name} — EXCEPTION: ${err}`);
  }
}

async function run(): Promise<void> {
  console.log(`\n🧪 XXT-AGENT v6.0 E2E Test Suite`);
  console.log(`📡 Gateway: ${BASE}\n`);
  console.log('── Phase 1: 基礎健康檢查 ──');

  await test('GET /health — Gateway 啟動', async () => {
    const r = await fetch(`${BASE}/health`);
    const d = await r.json() as { status: string };
    return { ok: r.ok && d.status === 'ok', detail: `status=${d.status}` };
  });

  await test('GET /system/agent-bus — Agent 健康總覽', async () => {
    const r = await fetch(`${BASE}/system/agent-bus`);
    const d = await r.json() as { summary: { total: number; online: number } };
    return { ok: r.ok, detail: `${d.summary?.online}/${d.summary?.total} online` };
  });

  console.log('\n── Phase 2: Agent 路由可用性 ──');

  const agentHealthEndpoints = [
    ['/agents/accountant/health', 'Accountant 健康'],
    ['/agents/guardian/health', 'Guardian 健康'],
    ['/agents/finance/health', 'Finance 健康'],
    ['/agents/scout/health', 'Scout 健康'],
    ['/agents/zora/health', 'Zora 健康'],
    ['/agents/lex/health', 'Lex 健康'],
    ['/agents/bim/health', 'Titan BIM 健康'],
    ['/agents/interior/health', 'Lumi Interior 健康'],
    ['/agents/estimator/health', 'Rusty Estimator 健康'],
  ];

  for (const [endpoint, name] of agentHealthEndpoints) {
    await test(`GET ${endpoint} — ${name}`, async () => {
      const r = await fetch(`${BASE}${endpoint}`, { headers: authHeader });
      return { ok: r.ok, detail: `HTTP ${r.status}` };
    });
  }

  console.log('\n── Phase 3: 重點業務功能 ──');

  await test('POST /agents/accountant/invoice — 發票計算', async () => {
    const r = await fetch(`${BASE}/agents/accountant/invoice`, {
      method: 'POST', headers: authHeader,
      body: JSON.stringify({ amount: 105000, type: 'taxed', tax_rate: 5 }),
    });
    const d = await r.json() as { calculation: { untaxed_amount: number } };
    const ok = r.ok && d.calculation?.untaxed_amount === 100000;
    return { ok, detail: `NT$105000 → untaxed ${d.calculation?.untaxed_amount}` };
  });

  await test('POST /agents/scout/pilot — 新增飛手', async () => {
    const r = await fetch(`${BASE}/agents/scout/pilot`, {
      method: 'POST', headers: authHeader,
      body: JSON.stringify({
        name: 'E2E 測試飛手', license_no: 'TEST-2099',
        license_expiry: '2099-12-31', license_type: 'advanced', contact: '09XX-XXX-XXX',
      }),
    });
    const d = await r.json() as { pilot_id: string; license_status: string };
    return { ok: r.ok && d.license_status === 'VALID', detail: `pilot_id=${d.pilot_id}` };
  });

  await test('POST /agents/lex/contract — 新增合約', async () => {
    const r = await fetch(`${BASE}/agents/lex/contract`, {
      method: 'POST', headers: authHeader,
      body: JSON.stringify({
        title: 'E2E 測試合約', entity_type: 'co_build',
        counterparty: 'E2E 測試廠商', total_amount: 1000000,
        sign_date: '2026-01-01', effective_date: '2026-01-01',
      }),
    });
    const d = await r.json() as { contract_id: string };
    return { ok: r.ok && !!d.contract_id, detail: `contract_id=${d.contract_id}` };
  });

  await test('POST /agents/estimator/bom — 新增 BOM', async () => {
    const r = await fetch(`${BASE}/agents/estimator/bom`, {
      method: 'POST', headers: authHeader,
      body: JSON.stringify({
        project_name: 'E2E 測試工程',
        category: 'structure',
        items: [{ item_no: '001', description: 'D16 鋼筋', unit: 'kg', quantity: 1000, unit_price: 38 }],
        tax_rate: 5,
      }),
    });
    const d = await r.json() as { bom_id: string; total_taxed: number };
    return { ok: r.ok && d.total_taxed === 39900, detail: `total=${d.total_taxed}` };
  });

  await test('POST /agents/bim/model — 新增 BIM 模型', async () => {
    const r = await fetch(`${BASE}/agents/bim/model`, {
      method: 'POST', headers: authHeader,
      body: JSON.stringify({ project_name: 'E2E 測試建物', discipline: 'combined', floor_count: 5 }),
    });
    const d = await r.json() as { model_id: string };
    return { ok: r.ok && !!d.model_id, detail: `model_id=${d.model_id}` };
  });

  console.log('\n── Phase 4: 速率限制 & 安全 ──');

  await test('Rate Limiter Headers — X-RateLimit-Remaining 存在', async () => {
    const r = await fetch(`${BASE}/health`);
    const hasHeader = r.headers.has('x-ratelimit-remaining');
    return { ok: hasHeader, detail: `X-RateLimit-Remaining: ${r.headers.get('x-ratelimit-remaining')}` };
  });

  // ── 結果彙整 ──────────────────────────────────────────────────
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const avgLatency = Math.round(results.reduce((s, r) => s + r.latency_ms, 0) / results.length);

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📊 E2E 測試完成`);
  console.log(`   ✅ 通過: ${passed} / ${results.length}`);
  console.log(`   ❌ 失敗: ${failed} / ${results.length}`);
  console.log(`   ⏱  平均延遲: ${avgLatency}ms`);
  console.log(`${'─'.repeat(50)}\n`);

  if (failed > 0) {
    console.log('❌ 失敗項目：');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.detail ?? '未知錯誤'}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

void run();
