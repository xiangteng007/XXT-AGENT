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
interface OpenClawEmitPayload {
    type: string;
    source: string;
    severity?: 'info' | 'warning' | 'error';
    target_agent?: string;
    task_id?: string;
    payload?: Record<string, unknown>;
}
/**
 * 向 OpenClaw Gateway POST 一個事件（fire-and-forget）。
 * 此函數永遠不會拋出例外，失敗只寫 logger.warn。
 */
export declare function emitOpenClawEvent(event: OpenClawEmitPayload): Promise<void>;
export declare const ocEmit: {
    readonly newsIngested: (count: number, sources: string[]) => Promise<void>;
    readonly fusionPulse: (correlationId: string, summary?: string) => Promise<void>;
    readonly taskQueued: (jobId: string, tenantId: string) => Promise<void>;
    readonly taskRunning: (jobId: string, tenantId: string) => Promise<void>;
    readonly taskDone: (jobId: string, tenantId: string, latencyMs: number) => Promise<void>;
    readonly taskFailed: (jobId: string, tenantId: string, reason: string) => Promise<void>;
    readonly decisionReady: (uid: string, summary: string) => Promise<void>;
    readonly cacheRefresh: (collection: string) => Promise<void>;
};
export {};
//# sourceMappingURL=openclaw-emitter.service.d.ts.map