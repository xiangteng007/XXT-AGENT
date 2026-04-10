/**
 * Agent Audit Logger — NemoClaw Layer 3
 *
 * 將每個 AI 決策記錄到 Firestore agent_audit_logs collection。
 * 為未來 SaaS 多租戶計費和合規稽核奠基。
 *
 * 記錄欄位遵循 constitution.md Part 4 定義的 AgentAuditLog schema。
 *
 * 注意：本模組使用 lazy Firestore 連線，若 Firestore 未設定，
 * 降級為 in-memory 環形 buffer（最多保留 500 條），不影響主流程。
 */

import { logger } from './logger';
import type { PrivacyClassification } from './privacy-router';

// ── 型別 ──────────────────────────────────────────────────────
export interface AgentAuditLog {
  // 識別
  trace_id: string;
  session_id?: string;
  user_id?: string;

  // 執行
  agent_id: string;
  action: string;
  input_preview: string;    // PRIVATE → [REDACTED]
  output_preview?: string;

  // 資源
  model_used: string;
  route: 'local' | 'cloud';
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
  cost_usd: number;         // 本地 = 0

  // 稽核
  privacy_level: 'PRIVATE' | 'INTERNAL' | 'PUBLIC';
  policy_applied: string;
  timestamp: string;
}

// ── 費用估算（雲端模型參考值，本地永遠 = 0）──────────────────
const CLOUD_COST_PER_1K_IN: Record<string, number> = {
  'gemini-2.5-flash': 0.000075,   // USD per 1k input tokens
  'gemini-2.5-pro': 0.00125,
  'claude-sonnet-4.6': 0.003,
  'gpt-4o': 0.005,
  'gpt-4o-mini': 0.00015,
};

function estimateCost(model: string, route: 'local' | 'cloud', tokensIn = 0): number {
  if (route === 'local') return 0;
  const rate = CLOUD_COST_PER_1K_IN[model] ?? 0;
  return Math.round((tokensIn / 1000) * rate * 1_000_000) / 1_000_000; // round to 6 decimals
}

// ── In-memory fallback buffer ────────────────────────────────
const IN_MEMORY_BUFFER: AgentAuditLog[] = [];
const BUFFER_MAX = 500;

function bufferPush(log: AgentAuditLog): void {
  if (IN_MEMORY_BUFFER.length >= BUFFER_MAX) {
    IN_MEMORY_BUFFER.shift(); // 移除最舊一條
  }
  IN_MEMORY_BUFFER.push(log);
}

// ── Firestore 連線（從單例取得）───────────────────────────────
import { getDb as getFirestoreDb } from './firestore-client';

let _db: FirebaseFirestore.Firestore | null = null;

function getDb(): FirebaseFirestore.Firestore | null {
  if (_db) return _db;
  _db = getFirestoreDb();
  return _db;
}

// ── 核心寫入函數 ──────────────────────────────────────────────
/**
 * 寫入一條稽核記錄（非同步，不阻塞主流程）
 */
export async function writeAuditLog(log: AgentAuditLog): Promise<void> {
  const db = await getDb();

  if (!db) {
    bufferPush(log);
    logger.debug(`[AuditLogger] Buffered (no Firestore): ${log.trace_id} | ${log.agent_id} | ${log.route} | ${log.privacy_level}`);
    return;
  }

  try {
    await db.collection('agent_audit_logs').doc(log.trace_id).set(log);
    logger.debug(`[AuditLogger] Written to Firestore: ${log.trace_id}`);
  } catch (err) {
    // Firestore 寫入失敗不影響主流程
    bufferPush(log);
    logger.warn(`[AuditLogger] Firestore write failed, buffered: ${String(err)}`);
  }
}

// ── 包裝器：自動計時 + 稽核 ───────────────────────────────────
/**
 * 包裝一個 AI 呼叫，自動記錄輸入/輸出/延遲/費用
 *
 * @example
 * const result = await wrapWithAudit(
 *   { agentId: 'market-analyst', action: 'ANALYZE_STOCK', classification, traceId },
 *   () => fetch(endpoint, { body: JSON.stringify({ model, messages }) })
 * );
 */
export async function wrapWithAudit<T>(
  meta: {
    agentId: string;
    action: string;
    classification: PrivacyClassification;
    inputPreview: string;
    traceId: string;
    sessionId?: string;
    userId?: string;
    model: string;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  let result: T;

  try {
    result = await fn();
  } catch (err) {
    const latency_ms = Date.now() - start;
    // 記錄失敗
    void writeAuditLog({
      trace_id: meta.traceId,
      session_id: meta.sessionId,
      user_id: meta.userId,
      agent_id: meta.agentId,
      action: `${meta.action}_FAILED`,
      input_preview: meta.inputPreview,
      output_preview: String(err),
      model_used: meta.model,
      route: meta.classification.routeTo,
      latency_ms,
      cost_usd: 0,
      privacy_level: meta.classification.level,
      policy_applied: meta.classification.reason,
      timestamp: new Date().toISOString(),
    });
    throw err;
  }

  const latency_ms = Date.now() - start;

  void writeAuditLog({
    trace_id: meta.traceId,
    session_id: meta.sessionId,
    user_id: meta.userId,
    agent_id: meta.agentId,
    action: meta.action,
    input_preview: meta.inputPreview,
    model_used: meta.model,
    route: meta.classification.routeTo,
    latency_ms,
    cost_usd: estimateCost(meta.model, meta.classification.routeTo),
    privacy_level: meta.classification.level,
    policy_applied: meta.classification.reason,
    timestamp: new Date().toISOString(),
  });

  return result;
}

// ── 查詢函數 ─────────────────────────────────────────────────
/**
 * 取得最近的稽核記錄（優先 Firestore，fallback in-memory）
 */
export async function getRecentLogs(limit = 50): Promise<AgentAuditLog[]> {
  const db = await getDb();

  if (!db) {
    return IN_MEMORY_BUFFER.slice(-limit).reverse();
  }

  try {
    const snap = await db
      .collection('agent_audit_logs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(d => d.data() as AgentAuditLog);
  } catch {
    return IN_MEMORY_BUFFER.slice(-limit).reverse();
  }
}

/**
 * 今日統計摘要
 */
export async function getDailyStats(): Promise<{
  total_requests: number;
  local_requests: number;
  cloud_requests: number;
  private_requests: number;
  estimated_cost_usd: number;
  top_agents: Record<string, number>;
}> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const db = await getDb();
  let logs: AgentAuditLog[] = [];

  if (db) {
    try {
      const snap = await db
        .collection('agent_audit_logs')
        .where('timestamp', '>=', startOfDay.toISOString())
        .get();
      logs = snap.docs.map(d => d.data() as AgentAuditLog);
    } catch {
      logs = IN_MEMORY_BUFFER.filter(l => l.timestamp >= startOfDay.toISOString());
    }
  } else {
    logs = IN_MEMORY_BUFFER.filter(l => l.timestamp >= startOfDay.toISOString());
  }

  const top_agents: Record<string, number> = {};
  let estimated_cost_usd = 0;

  for (const log of logs) {
    top_agents[log.agent_id] = (top_agents[log.agent_id] ?? 0) + 1;
    estimated_cost_usd += log.cost_usd;
  }

  return {
    total_requests: logs.length,
    local_requests: logs.filter(l => l.route === 'local').length,
    cloud_requests: logs.filter(l => l.route === 'cloud').length,
    private_requests: logs.filter(l => l.privacy_level === 'PRIVATE').length,
    estimated_cost_usd: Math.round(estimated_cost_usd * 1_000_000) / 1_000_000,
    top_agents,
  };
}

export { IN_MEMORY_BUFFER };
