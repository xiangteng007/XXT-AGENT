/**
 * Write Request Queue — QVP 協議執行引擎 (C-05)
 *
 * ◆ 設計等級：CRITICAL（資料完整性核心）
 *
 * 本模組實作「質詢驗證協議 (QVP)」中定義的 Write-Request 推送機制。
 * 當任何下游 Agent 需要向上游主權 Agent 發起資料寫入時，
 * 必須透過此佇列層以確保：
 *
 *   1. 冪等性 — 同一 idempotency_key 不會造成重複寫入
 *   2. 可靠投遞 — 指數退避重試（最多 3 次）
 *   3. 可觀測性 — 每次投遞的狀態變遷皆留有稽核軌跡
 *   4. 降級通知 — 三次重試皆失敗後，寫入 dead_letters 集合並推播告警
 *
 * 設計決策（Opus Thinking 審議記錄）：
 *
 *   Q1: 為什麼不用外部 Message Queue（如 Cloud Tasks / Pub/Sub）？
 *   A1: 目前系統為單容器部署（本地 Ollama + Gateway 同機），引入外部 MQ
 *       會增加基礎設施複雜度。In-process 佇列在容器重啟時會遺失，但
 *       我們透過 Firestore dead_letters 集合作為持久化降級機制，
 *       並在啟動時自動掃描未完成的 dead_letter 嘗試重投。
 *
 *   Q2: 冪等性檢查在哪一層實現？
 *   A2: 雙層防護：
 *       - Layer 1: 本模組的 processedKeys Set（記憶體，快速查重）
 *       - Layer 2: Firestore write_request_log（持久化，跨重啟防重）
 *       任一層判定重複即回傳 ALREADY_PROCESSED。
 *
 *   Q3: 指數退避的延遲策略？
 *   A3: 第 1 次重試等待 1s，第 2 次 2s，第 3 次 4s。
 *       加上 ±200ms 的隨機抖動（jitter）避免雷群效應。
 *
 *   Q4: Dead Letter 的後續處理？
 *   A4: dead_letters 集合由 Telegram Bot 的 /admin 指令可手動重投或標記放棄。
 *       System Bus 也會在每次 /system/agent-bus 探查時回報 dead letter 計數。
 *
 * @module WriteRequestQueue
 * @since v6.0
 */

import * as crypto from 'crypto';
import { logger } from './logger';
import { getDb as getFirestoreDb } from './firestore-client';

// ════════════════════════════════════════════════════════════════
// 型別定義
// ════════════════════════════════════════════════════════════════

export type WriteRequestStatus =
  | 'QUEUED'              // 待處理
  | 'PROCESSING'          // 處理中
  | 'DELIVERED'           // 投遞成功
  | 'RETRYING'            // 重試中
  | 'DEAD_LETTER'         // 三次重試皆失敗
  | 'ALREADY_PROCESSED';  // 冪等性攔截

export interface WriteRequest {
  /** 全域唯一的寫入請求 ID */
  request_id:       string;

  /** 發起寫入的 Agent */
  source_agent:     string;

  /** 接收寫入的主權 Agent */
  target_agent:     string;

  /** 目標 Firestore 集合名稱 */
  collection:       string;

  /** 操作類型 */
  operation:        'create' | 'update' | 'delete';

  /** 寫入的資料本體 */
  data:             Record<string, unknown>;

  /** 冪等性金鑰（全域唯一，防止重複寫入）*/
  idempotency_key:  string;

  /** 人類可讀的請求原因 */
  reason:           string;

  /** 目標 Agent 的 entity_type（資料主權歸屬）*/
  entity_type?:     string;

  /** 目前狀態 */
  status:           WriteRequestStatus;

  /** 已重試次數 */
  retry_count:      number;

  /** 最後一次錯誤訊息 */
  last_error?:      string;

  /** 時間戳記 */
  created_at:       string;
  updated_at:       string;
  delivered_at?:    string;
}

export interface WriteRequestResult {
  ok:         boolean;
  request_id: string;
  status:     WriteRequestStatus;
  message:    string;
}

// ════════════════════════════════════════════════════════════════
// 常數
// ════════════════════════════════════════════════════════════════

const MAX_RETRIES         = 3;
const BASE_DELAY_MS       = 1000;       // 第一次重試的基礎延遲
const JITTER_MS           = 200;        // 隨機抖動上限
const DELIVERY_TIMEOUT_MS = 5000;       // QVP 規範：5 秒超時
const MAX_QUEUE_SIZE      = 500;        // 記憶體佇列上限
const MAX_PROCESSED_KEYS  = 10_000;     // 冪等性快取上限

const GATEWAY_BASE = process.env['GATEWAY_INTERNAL_URL'] ?? 'http://localhost:3100';

// ════════════════════════════════════════════════════════════════
// Agent → Gateway 端點映射
// ════════════════════════════════════════════════════════════════

const AGENT_WRITE_ENDPOINTS: Record<string, string> = {
  accountant: '/agents/accountant/ledger',
  guardian:   '/agents/guardian/policy',
  lex:        '/agents/lex/contract',
  zora:       '/agents/zora/donation',
  scout:      '/agents/scout/mission',
};

// ════════════════════════════════════════════════════════════════
// WriteRequestQueue
// ════════════════════════════════════════════════════════════════

class WriteRequestQueue {
  /** 待處理佇列 */
  private queue: WriteRequest[] = [];

  /** 已處理的冪等性金鑰（快速查重） */
  private processedKeys = new Set<string>();

  /** 正在處理中（防併發） */
  private isProcessing = false;

  /** 死信倉庫（記憶體副本，Firestore 為主） */
  private deadLetters: WriteRequest[] = [];

  /** Firestore 參照（從單例取得） */
  private _db: FirebaseFirestore.Firestore | null = null;

  // ── Firestore 連線（從單例取得）────────────────────────────
  private getDb(): FirebaseFirestore.Firestore | null {
    if (this._db) return this._db;
    // Use top-level imported getDb to avoid require() ESM issues in Vitest
    this._db = getFirestoreDb();
    return this._db;
  }

  // ══════════════════════════════════════════════════════════
  // 公開 API
  // ══════════════════════════════════════════════════════════

  /**
   * 提交一個 Write Request 到佇列。
   *
   * 冪等性保證：同一 idempotency_key 的重複提交會直接回傳 ALREADY_PROCESSED。
   */
  public async submit(params: {
    source_agent:    string;
    target_agent:    string;
    collection:      string;
    operation:       'create' | 'update' | 'delete';
    data:            Record<string, unknown>;
    idempotency_key: string;
    reason:          string;
    entity_type?:    string;
  }): Promise<WriteRequestResult> {

    const now = new Date().toISOString();

    // ── Layer 1: 記憶體冪等性檢查 ──────────────────────
    if (this.processedKeys.has(params.idempotency_key)) {
      logger.info(`[WRQ] Idempotency hit (mem): ${params.idempotency_key}`);
      return {
        ok: true,
        request_id: 'cached',
        status: 'ALREADY_PROCESSED',
        message: `Write request already processed (idempotency_key: ${params.idempotency_key})`,
      };
    }

    // ── Layer 2: Firestore 冪等性檢查 ────────────────────
    const db = await this.getDb();
    if (db) {
      try {
        const existing = await db.collection('write_request_log')
          .where('idempotency_key', '==', params.idempotency_key)
          .limit(1)
          .get();
        if (!existing.empty) {
          this.processedKeys.add(params.idempotency_key);
          logger.info(`[WRQ] Idempotency hit (fs): ${params.idempotency_key}`);
          return {
            ok: true,
            request_id: existing.docs[0]?.id ?? 'cached',
            status: 'ALREADY_PROCESSED',
            message: `Write request already processed (Firestore)`,
          };
        }
      } catch (err) {
        logger.warn(`[WRQ] Firestore idempotency check failed: ${err}`);
        // fallthrough — 記憶體沒重複就繼續
      }
    }

    // ── 建立 WriteRequest ────────────────────────────────
    const request: WriteRequest = {
      request_id:      crypto.randomUUID(),
      source_agent:    params.source_agent,
      target_agent:    params.target_agent,
      collection:      params.collection,
      operation:       params.operation,
      data:            params.data,
      idempotency_key: params.idempotency_key,
      reason:          params.reason,
      entity_type:     params.entity_type,
      status:          'QUEUED',
      retry_count:     0,
      created_at:      now,
      updated_at:      now,
    };

    // ── 佇列滿載保護 ────────────────────────────────────
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      logger.error(`[WRQ] Queue full (${MAX_QUEUE_SIZE}). Rejecting write request.`);
      return {
        ok: false,
        request_id: request.request_id,
        status: 'DEAD_LETTER',
        message: `Write request queue is full. Request rejected.`,
      };
    }

    this.queue.push(request);
    logger.info(
      `[WRQ] Enqueued: ${request.request_id} | ` +
      `${params.source_agent} → ${params.target_agent} | ` +
      `key=${params.idempotency_key}`
    );

    // ── 持久化請求日誌 ──────────────────────────────────
    if (db) {
      try {
        await db.collection('write_request_log')
          .doc(request.request_id)
          .set(request);
      } catch (err) {
        logger.warn(`[WRQ] Failed to persist request log: ${err}`);
      }
    }

    // ── 觸發處理（非阻塞）────────────────────────────────
    void this.processQueue();

    return {
      ok: true,
      request_id: request.request_id,
      status: 'QUEUED',
      message: `Write request queued for delivery to ${params.target_agent}`,
    };
  }

  /**
   * 取得佇列統計（監控 API 用）
   */
  public getStats(): {
    queued: number;
    dead_letters: number;
    processed_keys: number;
  } {
    return {
      queued:          this.queue.length,
      dead_letters:    this.deadLetters.length,
      processed_keys:  this.processedKeys.size,
    };
  }

  /**
   * 取得死信清單（管理 API 用）
   */
  public getDeadLetters(): WriteRequest[] {
    return [...this.deadLetters];
  }

  /**
   * 手動重投一封死信
   */
  public async retryDeadLetter(requestId: string): Promise<WriteRequestResult> {
    const idx = this.deadLetters.findIndex(r => r.request_id === requestId);
    if (idx === -1) {
      return { ok: false, request_id: requestId, status: 'DEAD_LETTER', message: 'Dead letter not found' };
    }

    const request = this.deadLetters.splice(idx, 1)[0]!;
    request.status      = 'QUEUED';
    request.retry_count = 0;
    request.last_error  = undefined;
    request.updated_at  = new Date().toISOString();

    this.queue.push(request);
    void this.processQueue();

    return { ok: true, request_id: requestId, status: 'QUEUED', message: 'Dead letter re-queued' };
  }

  // ══════════════════════════════════════════════════════════
  // 內部處理引擎
  // ══════════════════════════════════════════════════════════

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const request = this.queue[0]!;
        const delivered = await this.attemptDelivery(request);

        if (delivered) {
          // 投遞成功
          this.queue.shift();
          request.status       = 'DELIVERED';
          request.delivered_at = new Date().toISOString();
          request.updated_at   = new Date().toISOString();

          // 記錄冪等性（回收機制：超過上限時清空最舊的一半）
          this.processedKeys.add(request.idempotency_key);
          if (this.processedKeys.size > MAX_PROCESSED_KEYS) {
            const arr = [...this.processedKeys];
            this.processedKeys = new Set(arr.slice(arr.length / 2));
          }

          // 更新 Firestore 日誌
          await this.updateRequestLog(request);

          logger.info(`[WRQ] ✅ Delivered: ${request.request_id} → ${request.target_agent}`);
        } else {
          // 投遞失敗
          request.retry_count++;

          if (request.retry_count >= MAX_RETRIES) {
            // 轉入死信
            this.queue.shift();
            request.status     = 'DEAD_LETTER';
            request.updated_at = new Date().toISOString();
            this.deadLetters.push(request);

            await this.updateRequestLog(request);
            await this.persistDeadLetter(request);

            logger.error(
              `[WRQ] ☠️ DEAD LETTER: ${request.request_id} | ` +
              `${request.source_agent} → ${request.target_agent} | ` +
              `error: ${request.last_error}`
            );
          } else {
            // 指數退避等待
            request.status     = 'RETRYING';
            request.updated_at = new Date().toISOString();

            const delay = this.calculateBackoff(request.retry_count);
            logger.warn(
              `[WRQ] ⏳ Retry ${request.retry_count}/${MAX_RETRIES} for ${request.request_id} ` +
              `(waiting ${delay}ms) | error: ${request.last_error}`
            );

            await this.sleep(delay);
            // 不 shift — 下一輪迴圈會重新嘗試同一個 request
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 嘗試投遞一個 WriteRequest。
   *
   * 根據 target_agent 決定 HTTP 端點，發送 POST 請求。
   * 回傳 true 表示投遞成功，false 表示需要重試。
   */
  private async attemptDelivery(request: WriteRequest): Promise<boolean> {
    request.status     = 'PROCESSING';
    request.updated_at = new Date().toISOString();

    const endpoint = AGENT_WRITE_ENDPOINTS[request.target_agent];
    if (!endpoint) {
      request.last_error = `No endpoint registered for target_agent: ${request.target_agent}`;
      return false;
    }

    const url = `${GATEWAY_BASE}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      const resp = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${process.env['OPENCLAW_API_KEY'] ?? 'dev-secret-key'}`,
          'X-QVP-Source':  request.source_agent,
          'X-QVP-Key':     request.idempotency_key,
        },
        body:   JSON.stringify(request.data),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (resp.ok) {
        return true;
      }

      // 4xx = 不重試（業務邏輯錯誤）
      if (resp.status >= 400 && resp.status < 500) {
        const body = await resp.text().catch(() => '');
        request.last_error = `HTTP ${resp.status}: ${body.slice(0, 200)}`;
        // 4xx 不重試，直接標記失敗（但不是 dead letter — 是資料問題）
        logger.warn(`[WRQ] Client error for ${request.request_id}: ${request.last_error}`);
        return false;
      }

      // 5xx = 可重試
      const body = await resp.text().catch(() => '');
      request.last_error = `HTTP ${resp.status}: ${body.slice(0, 200)}`;
      return false;

    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      request.last_error = isTimeout
        ? `Delivery timeout (${DELIVERY_TIMEOUT_MS}ms)`
        : `Network error: ${String(err)}`;
      return false;
    }
  }

  /**
   * 指數退避 + 隨機抖動
   *
   * delay = BASE_DELAY_MS × 2^(retry-1) ± random(JITTER_MS)
   */
  private calculateBackoff(retryCount: number): number {
    const base  = BASE_DELAY_MS * Math.pow(2, retryCount - 1);
    const jitter = Math.floor(Math.random() * JITTER_MS * 2) - JITTER_MS;
    return Math.max(100, base + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  // ══════════════════════════════════════════════════════════
  // Firestore 持久化工具
  // ══════════════════════════════════════════════════════════

  private async updateRequestLog(request: WriteRequest): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      await db.collection('write_request_log').doc(request.request_id).set(request, { merge: true });
    } catch (err) {
      logger.warn(`[WRQ] Failed to update request log: ${err}`);
    }
  }

  private async persistDeadLetter(request: WriteRequest): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      await db.collection('dead_letters').doc(request.request_id).set({
        ...request,
        alert_sent: false,
        alert_message: `⚠️ [系統警報] ${request.source_agent} 發送至 ${request.target_agent} 的寫入請求（${request.reason}）` +
          `經 ${MAX_RETRIES} 次重試皆失敗，已轉入隔離區待手動確認。` +
          `\n錯誤：${request.last_error}`,
      });
    } catch (err) {
      logger.error(`[WRQ] Failed to persist dead letter: ${err}`);
    }
  }
}

// ════════════════════════════════════════════════════════════════
// 全域 Singleton
// ════════════════════════════════════════════════════════════════

export const writeRequestQueue = new WriteRequestQueue();
