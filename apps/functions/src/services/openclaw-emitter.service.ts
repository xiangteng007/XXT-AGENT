/**
 * OpenClaw Emitter Service
 *
 * 最小侵入式：在 Firebase Functions 中向 OpenClaw Gateway
 * 推送事件的 fire-and-forget 工具。
 *
 * 設計原則：
 *   1. 永不拋出，永不阻塞主流程（catch-all）
 *   2. 讀取 OPENCLAW_GATEWAY_URL env（未設定則 no-op）
 *   3. 使用 S2S 服務帳戶 token（Cloud Run → Cloud Run IAM）
 *   4. 支援 Cloud Functions v2（Node 20，有全域 fetch）
 */

import { logger } from 'firebase-functions/v2';

// ── 設定 ──────────────────────────────────────────────────────
const GATEWAY_INGEST_URL = process.env['OPENCLAW_GATEWAY_URL']
    ? `${process.env['OPENCLAW_GATEWAY_URL']}/events/ingest`
    : null;

const SERVICE_ACCOUNT_EMAIL = process.env['OPENCLAW_SA_EMAIL'] ?? null;

// ── 型別（與 @xxt-agent/types 的 OpenClawEvent 對齊，避免在 Functions 引入外部包）
interface OpenClawEmitPayload {
    type: string;
    source: string;
    severity?: 'info' | 'warning' | 'error';
    target_agent?: string;
    task_id?: string;
    payload?: Record<string, unknown>;
}

// ── 取得 S2S ID Token（Cloud Run → Cloud Run IAM）────────────
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getIdToken(): Promise<string | null> {
    if (!SERVICE_ACCOUNT_EMAIL && !process.env['FUNCTION_TARGET']) {
        // 本機開發：略過 token（Gateway 設 DEV_BYPASS_AUTH=true）
        return null;
    }

    const now = Date.now();
    if (_cachedToken && now < _tokenExpiry) return _cachedToken;

    try {
        // Cloud Run metadata server
        const audience = GATEWAY_INGEST_URL!;
        const metaUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`;
        const resp = await fetch(metaUrl, {
            headers: { 'Metadata-Flavor': 'Google' },
            signal: AbortSignal.timeout(1000),
        });
        if (!resp.ok) return null;
        _cachedToken = await resp.text();
        _tokenExpiry = now + 55 * 60 * 1000; // 55 分鐘（token TTL 60 分）
        return _cachedToken;
    } catch {
        return null;
    }
}

// ── 主要 emit 函數 ────────────────────────────────────────────
/**
 * 向 OpenClaw Gateway POST 一個事件（fire-and-forget）。
 * 此函數永遠不會拋出例外，失敗只寫 logger.warn。
 */
export async function emitOpenClawEvent(event: OpenClawEmitPayload): Promise<void> {
    if (!GATEWAY_INGEST_URL) {
        // OPENCLAW_GATEWAY_URL 未設定 → 靜默跳過（開發 / 未整合環境）
        return;
    }

    try {
        const idToken = await getIdToken();

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
        }

        const body = JSON.stringify({
            id: crypto.randomUUID(),
            type: event.type,
            severity: event.severity ?? 'info',
            source: event.source,
            target_agent: event.target_agent ?? undefined,
            task_id: event.task_id ?? undefined,
            payload: event.payload ?? {},
            timestamp: new Date().toISOString(),
        });

        const resp = await fetch(GATEWAY_INGEST_URL, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(2000), // 2 秒上限，不阻塞主流程
        });

        if (!resp.ok) {
            logger.warn(`[OpenClaw Emitter] Gateway returned ${resp.status}`, {
                event_type: event.type,
            });
        }
    } catch (err) {
        // 永遠不拋出 — 僅警告
        logger.warn('[OpenClaw Emitter] Emit failed (non-blocking)', {
            error: err instanceof Error ? err.message : String(err),
            event_type: event.type,
        });
    }
}

// ── 便利捷徑（避免拼錯 EventType 字串）──────────────────────
export const ocEmit = {
    newsIngested: (count: number, sources: string[]) =>
        emitOpenClawEvent({
            type: 'NEWS_INGESTED',
            source: 'news-collector',
            target_agent: 'flashbot',
            payload: { count, sources },
        }),

    fusionPulse: (correlationId: string, summary?: string) =>
        emitOpenClawEvent({
            type: 'FUSION_PULSE',
            source: 'fusion-engine',
            target_agent: 'flashbot',
            payload: { correlation_id: correlationId, summary },
        }),

    taskQueued: (jobId: string, tenantId: string) =>
        emitOpenClawEvent({
            type: 'TASK_QUEUED',
            source: 'webhook-handler',
            payload: { job_id: jobId, tenant_id: tenantId },
        }),

    taskRunning: (jobId: string, tenantId: string) =>
        emitOpenClawEvent({
            type: 'TASK_RUNNING',
            source: 'worker',
            payload: { job_id: jobId, tenant_id: tenantId },
        }),

    taskDone: (jobId: string, tenantId: string, latencyMs: number) =>
        emitOpenClawEvent({
            type: 'TASK_DONE',
            source: 'worker',
            payload: { job_id: jobId, tenant_id: tenantId, latency_ms: latencyMs },
        }),

    taskFailed: (jobId: string, tenantId: string, reason: string) =>
        emitOpenClawEvent({
            type: 'TASK_FAILED',
            source: 'worker',
            severity: 'error',
            payload: { job_id: jobId, tenant_id: tenantId, reason },
        }),

    decisionReady: (uid: string, summary: string) =>
        emitOpenClawEvent({
            type: 'DECISION_READY',
            source: 'butler-api',
            target_agent: 'director',
            payload: { uid, summary },
        }),

    cacheRefresh: (collection: string) =>
        emitOpenClawEvent({
            type: 'CACHE_REFRESH',
            source: 'butler-webhook',
            payload: { collection },
        }),
} as const;
