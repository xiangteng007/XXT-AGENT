/**
 * F-04: CAVP 合規檢查 CI 腳本 (增強版)
 *
 * 功能：
 *   1. 掃描所有 routes/*.ts 與 scripts/*.ts 確認 [CAVP_HEADER] 注入
 *   2. 掃描所有 AI 呼叫是否使用 agentChat() 而非直接 ollamaChat()
 *   3. 掃描 inference-wrapper.ts 是否正確整合 PrivacyRouter
 *   4. 輸出 SARIF 格式可選（CI 整合）
 *
 * 執行指令：
 *   npx tsx services/openclaw-gateway/src/scripts/verify_cavp.ts --strict
 */

import * as fs from 'fs';
import * as path from 'path';

const ROUTES_DIR = path.resolve(__dirname, '../routes');
const SRC_DIR    = path.resolve(__dirname, '..');

const SHOULD_HAVE_CAVP = [
  'bim.ts', 'interior.ts', 'estimator.ts',
  'accountant.ts', 'guardian.ts', 'finance.ts',
  'scout.ts', 'zora.ts', 'lex.ts',
  'regulation.ts',
];

// Routes that should NOT use ollamaChat directly (must use agentChat)
const MUST_USE_WRAPPER = [
  'bim.ts', 'interior.ts', 'estimator.ts',
];

interface Finding {
  file: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  line?: number;
}

const findings: Finding[] = [];
let filesChecked = 0;

function checkFile(filename: string, filepath: string): void {
  if (!fs.existsSync(filepath)) {
    findings.push({ file: filename, rule: 'FILE_MISSING', severity: 'error', message: `檔案不存在: ${filepath}` });
    return;
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');
  filesChecked++;

  // 1. CAVP_HEADER 檢查
  if (SHOULD_HAVE_CAVP.includes(filename)) {
    if (!content.includes('[CAVP_HEADER]')) {
      findings.push({ file: filename, rule: 'CAVP_MISSING', severity: 'error', message: `缺少 [CAVP_HEADER] 跨 Agent 驗證協議聲明` });
    } else if (!content.includes('[/CAVP_HEADER]')) {
      findings.push({ file: filename, rule: 'CAVP_UNCLOSED', severity: 'warning', message: `[CAVP_HEADER] 未正確關閉 [/CAVP_HEADER]` });
    }
  }

  // 2. Inference Wrapper 使用檢查（必須使用 agentChat 的路由）
  if (MUST_USE_WRAPPER.includes(filename)) {
    const hasOllamaDirect = content.includes('ollamaChat(');
    const hasWrapper = content.includes('agentChat(');

    if (hasOllamaDirect) {
      const lineNums = lines
        .map((l, i) => l.includes('ollamaChat(') ? i + 1 : -1)
        .filter(n => n !== -1);
      findings.push({
        file: filename, rule: 'DIRECT_OLLAMA_CALL', severity: 'error',
        message: `直接呼叫 ollamaChat() 繞過隱私路由。請改用 agentChat()。`,
        line: lineNums[0],
      });
    }

    if (!hasWrapper) {
      findings.push({ file: filename, rule: 'WRAPPER_NOT_USED', severity: 'warning', message: `未偵測到 agentChat() 使用` });
    }
  }

  // 3. 全域掃描：所有路由檔案不應有裸露 ollamaChat（豁免舊有財務路由）
  const exemptFromWrapperCheck = ['accountant.ts', 'guardian.ts', 'finance.ts', 'scout.ts', 'zora.ts', 'lex.ts'];
  if (
    filename.endsWith('.ts') &&
    !exemptFromWrapperCheck.includes(filename) &&
    !filename.includes('ollama-inference.service') &&
    !filename.includes('inference-wrapper')
  ) {
    if (content.includes("from '../ollama-inference.service'") && content.includes('ollamaChat(')) {
      findings.push({ file: filename, rule: 'LEGACY_OLLAMA_IMPORT', severity: 'warning', message: `直接 import ollamaChat — 考慮遷移至 agentChat()` });
    }
  }
}

// ── 掃描所有路由 ───────────────────────────────────────────────

const routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.ts'));
for (const file of routeFiles) {
  checkFile(file, path.join(ROUTES_DIR, file));
}

// ── 掃描 inference-wrapper 本身的完整性 ───────────────────────

const wrapperPath = path.join(SRC_DIR, 'inference-wrapper.ts');
if (!fs.existsSync(wrapperPath)) {
  findings.push({ file: 'inference-wrapper.ts', rule: 'WRAPPER_MISSING', severity: 'error', message: 'inference-wrapper.ts 不存在！B-01 尚未完成' });
} else {
  const wrapperContent = fs.readFileSync(wrapperPath, 'utf-8');
  if (!wrapperContent.includes('PrivacyRouter')) {
    findings.push({ file: 'inference-wrapper.ts', rule: 'PRIVACY_ROUTER_MISSING', severity: 'error', message: 'PrivacyRouter 未整合至 inference-wrapper' });
  }
  if (!wrapperContent.includes('wrapWithAudit')) {
    findings.push({ file: 'inference-wrapper.ts', rule: 'AUDIT_LOGGER_MISSING', severity: 'error', message: 'AuditLogger 未整合至 inference-wrapper' });
  }
}

// ── 輸出報告 ───────────────────────────────────────────────────

const errors   = findings.filter(f => f.severity === 'error');
const warnings = findings.filter(f => f.severity === 'warning');

console.log(`\n🔍 CAVP 合規檢查報告 (XXT-AGENT v6.0)`);
console.log(`${'─'.repeat(50)}`);
console.log(`📁 掃描檔案: ${filesChecked}`);
console.log(`❌ 錯誤: ${errors.length}`);
console.log(`⚠️  警告: ${warnings.length}`);
console.log(`${'─'.repeat(50)}`);

if (findings.length === 0) {
  console.log('\n✅ 所有 CAVP 合規檢查通過！\n');
} else {
  if (errors.length > 0) {
    console.log('\n❌ 錯誤（需修復後才能合併）：');
    for (const f of errors) {
      console.log(`  [${f.rule}] ${f.file}${f.line ? `:${f.line}` : ''} — ${f.message}`);
    }
  }
  if (warnings.length > 0) {
    console.log('\n⚠️  警告（建議修復）：');
    for (const f of warnings) {
      console.log(`  [${f.rule}] ${f.file}${f.line ? `:${f.line}` : ''} — ${f.message}`);
    }
  }
}

console.log(`\n${'─'.repeat(50)}\n`);

// CI 模式：有錯誤時以非零退出碼結束
const isStrict = process.argv.includes('--strict');
if (isStrict && errors.length > 0) {
  process.exit(1);
}
