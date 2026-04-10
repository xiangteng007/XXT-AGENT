/**
 * Local Runner Circuit Breaker（A-3 規格）
 *
 * 三種事件：
 *   LOCAL_RUNNER_UNCONFIGURED  — Cloud mode，BASE_URL 為空
 *   LOCAL_RUNNER_OFFLINE       — Health check 失敗（Local mode）
 *   LOCAL_RUNNER_ONLINE        — 恢復可達
 *
 * Circuit 流程（Local mode）：
 *   1) now - last_ok_ts < LAST_OK_GRACE_MS  → 走 local（不打 health）
 *   2) now < offline_until_ts               → 走 cloud（不重複 emit OFFLINE）
 *   3) 打 /health（timeout 500ms）
 *      OK   → 更新 last_ok_ts，走 local
 *      FAIL → offline_until_ts = now + 10s，emit OFFLINE
 */
import { randomUUID } from "node:crypto";
import { EventType, EventSeverity } from "@xxt-agent/types";
import type { OpenClawEvent } from "@xxt-agent/types";
import { logger } from "./logger";

const DEPLOY_MODE = process.env["DEPLOY_MODE"] ?? "local";
const LOCAL_RUNNER_BASE_URL = process.env["LOCAL_RUNNER_BASE_URL"] ?? "";
const HEALTH_TIMEOUT_MS = parseInt(
  process.env["LOCAL_RUNNER_HEALTH_TIMEOUT_MS"] ?? "500",
  10,
);
const LAST_OK_GRACE_MS = parseInt(
  process.env["LOCAL_RUNNER_LAST_OK_GRACE_MS"] ?? "5000",
  10,
);
const OFFLINE_COOLDOWN_MS = parseInt(
  process.env["LOCAL_RUNNER_OFFLINE_COOLDOWN_MS"] ?? "10000",
  10,
);

// ── 建立事件工廠 ──────────────────────────────────────────────
function makeEvent(
  type: EventType,
  payload: Record<string, unknown> = {},
): OpenClawEvent {
  let severity: EventSeverity = "info";
  if (type === EventType.LOCAL_RUNNER_OFFLINE) severity = "warning";
  if (type === EventType.LOCAL_RUNNER_UNCONFIGURED) severity = "warning";

  return {
    id: randomUUID(),
    type,
    severity,
    source: "openclaw-gateway",
    target_agent: "flashbot",
    payload,
    timestamp: new Date().toISOString(),
  };
}

// ── Circuit Breaker 類別 ───────────────────────────────────────
class LocalRunnerCircuitBreaker {
  private lastOkTs = 0;
  private offlineUntilTs = 0;
  private lastEmittedType: EventType | null = null;

  /**
   * 啟動時呼叫：決定初始狀態，回傳需要廣播的事件（若有）
   */
  async probe(): Promise<{ available: boolean; event: OpenClawEvent | null }> {
    // Cloud mode + BASE_URL 空 → UNCONFIGURED
    if (DEPLOY_MODE === "cloud" || LOCAL_RUNNER_BASE_URL === "") {
      const event = makeEvent(EventType.LOCAL_RUNNER_UNCONFIGURED, {
        reason: "CLOUD_MODE_BASEURL_EMPTY",
        deploy_mode: DEPLOY_MODE,
      });
      this.lastEmittedType = EventType.LOCAL_RUNNER_UNCONFIGURED;
      logger.info(
        "Local Runner: UNCONFIGURED (cloud mode or empty BASE_URL)",
      );
      return { available: false, event };
    }

    // Local mode → 執行健康檢查
    const result = await this._checkHealth();
    return result;
  }

  /**
   * 在推理請求前呼叫：回傳是否可走 local + 需廣播的事件（如狀態改變）
   */
  async canUseLocal(): Promise<{
    available: boolean;
    event: OpenClawEvent | null;
  }> {
    // Cloud mode 直接拒絕
    if (DEPLOY_MODE === "cloud" || LOCAL_RUNNER_BASE_URL === "") {
      return { available: false, event: null };
    }

    const now = Date.now();

    // Grace period：最近 5 秒內成功過 → 直接 local
    if (now - this.lastOkTs < LAST_OK_GRACE_MS) {
      return { available: true, event: null };
    }

    // Cooldown：仍在離線冷卻期 → cloud（不再 emit）
    if (now < this.offlineUntilTs) {
      return { available: false, event: null };
    }

    // 需要做健康檢查
    return this._checkHealth();
  }

  /**
   * 取得當前 Local Runner 狀態摘要（供 /health endpoint 使用）
   */
  getStatus(): Record<string, unknown> {
    const now = Date.now();
    let state: "unconfigured" | "online" | "offline" | "unknown";

    if (DEPLOY_MODE === "cloud" || LOCAL_RUNNER_BASE_URL === "") {
      state = "unconfigured";
    } else if (now - this.lastOkTs < LAST_OK_GRACE_MS) {
      state = "online";
    } else if (now < this.offlineUntilTs) {
      state = "offline";
    } else {
      state = "unknown";
    }

    return {
      state,
      deploy_mode: DEPLOY_MODE,
      base_url: LOCAL_RUNNER_BASE_URL || "(empty)",
      last_ok_ts: this.lastOkTs || null,
      offline_until_ts: this.offlineUntilTs || null,
    };
  }

  // ── 私有：實際打 Ollama /api/tags ──────────────────────────
  private async _checkHealth(): Promise<{
    available: boolean;
    event: OpenClawEvent | null;
  }> {
    // Ollama 不提供 /health，改用 /api/tags（列出已安裝模型）
    const url = `${LOCAL_RUNNER_BASE_URL}/api/tags`;
    const controller = new AbortController();
    // Ollama 在模型載入中可能較慢，timeout 調高至 2s
    const timer = setTimeout(
      () => controller.abort(),
      Math.max(HEALTH_TIMEOUT_MS, 2000),
    );

    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        method: "GET",
      });
      clearTimeout(timer);

      if (resp.ok) {
        // 成功
        this.lastOkTs = Date.now();

        // 若之前是 offline/unconfigured → emit ONLINE
        if (
          this.lastEmittedType === EventType.LOCAL_RUNNER_OFFLINE ||
          this.lastEmittedType === EventType.LOCAL_RUNNER_UNCONFIGURED
        ) {
          this.lastEmittedType = EventType.LOCAL_RUNNER_ONLINE;
          const event = makeEvent(EventType.LOCAL_RUNNER_ONLINE, {
            base_url: LOCAL_RUNNER_BASE_URL,
          });
          logger.info("Local Runner: ONLINE");
          return { available: true, event };
        }

        this.lastEmittedType = EventType.LOCAL_RUNNER_ONLINE;
        return { available: true, event: null };
      }

      // HTTP 非 2xx → 視為離線
      throw new Error(`HTTP ${resp.status}`);
    } catch (err) {
      clearTimeout(timer);
      const reason =
        err instanceof Error ? err.message : String(err);

      this.offlineUntilTs = Date.now() + OFFLINE_COOLDOWN_MS;

      // 避免重複 emit OFFLINE
      if (this.lastEmittedType === EventType.LOCAL_RUNNER_OFFLINE) {
        return { available: false, event: null };
      }

      this.lastEmittedType = EventType.LOCAL_RUNNER_OFFLINE;
      const event = makeEvent(EventType.LOCAL_RUNNER_OFFLINE, {
        reason,
        base_url: LOCAL_RUNNER_BASE_URL,
        cooldown_until: new Date(this.offlineUntilTs).toISOString(),
      });
      logger.warn(`Local Runner: OFFLINE (${reason})`);
      return { available: false, event };
    }
  }
}

// Singleton export
export const localRunner = new LocalRunnerCircuitBreaker();
export { makeEvent };
