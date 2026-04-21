/**
 * Reconciliation Route — C-1d Accountant ↔ Finance 對帳 API
 *
 * GET  /system/reconcile             — 執行對帳（可選 ?period=202604&entity_type=personal）
 * POST /system/reconcile             — 手動觸發全量對帳
 * GET  /system/reconcile/summary     — 僅回傳對帳結果摘要（Dashboard 用）
 *
 * 設計原則：
 *   - 對帳結果為 INTERNAL 等級（含金額，不對外公開）
 *   - 所有帳本/貸款資料查詢皆透過 Gateway 內部路由（不直接存取 Store）
 *   - 結果可選擇寫入 Firestore 作為歷史紀錄
 *
 * @module ReconciliationRoute
 * @since v8.0
 */

import { Router, Request, Response } from 'express';
import { logger } from '../logger';
import { performReconciliation } from '../reconciliation-engine';
import type { EntityType } from '../entity';

export const reconcileRouter = Router();


// ── P1-05 / A-04: Redis-based idempotency lock with renewal ──────
let redisClient: import('ioredis').default | null = null;

// A-04: Minimum lock TTL in seconds. Renewed every LOCK_RENEW_INTERVAL_MS.
const LOCK_BASE_TTL_SEC    = 60;   // initial grant
const LOCK_RENEW_INTERVAL_MS = 15_000; // renew every 15s

async function getRedisForLock(): Promise<import('ioredis').default | null> {
  if (redisClient) return redisClient;
  try {
    const Redis = (await import('ioredis')).default;
    redisClient = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379', {
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
    });
    return redisClient;
  } catch (e) {
    logger.warn(`[Reconcile] Redis unavailable for lock: ${e}`);
    return null;
  }
}

/**
 * Acquire a distributed lock for reconciliation.
 * Returns { acquired, lockKey } — caller must call releaseReconcileLock(lockKey).
 * A-04: Uses LOCK_BASE_TTL_SEC; caller should start a renewal timer.
 */
async function acquireReconcileLock(
  period: string,
  entity: string,
): Promise<{ acquired: boolean; lockKey: string }> {
  const lockKey = `reconcile_lock:${period}:${entity}`;
  const redis = await getRedisForLock();
  if (!redis) return { acquired: true, lockKey }; // graceful degradation
  const result = await redis.set(lockKey, '1', 'EX', LOCK_BASE_TTL_SEC, 'NX');
  return { acquired: result === 'OK', lockKey };
}

/**
 * A-04: Start a lock renewal timer that refreshes TTL every 15s.
 * Must call clearInterval on the returned timer when the task completes.
 */
async function startLockRenewal(lockKey: string): Promise<ReturnType<typeof setInterval> | null> {
  const redis = await getRedisForLock();
  if (!redis) return null;
  const timer = setInterval(async () => {
    try {
      await redis.expire(lockKey, LOCK_BASE_TTL_SEC);
      logger.debug(`[Reconcile] Lock renewed: ${lockKey}`);
    } catch (e) {
      logger.warn(`[Reconcile] Lock renewal failed: ${e}`);
    }
  }, LOCK_RENEW_INTERVAL_MS);
  // Allow Node.js to exit even if timer is active
  if (timer.unref) timer.unref();
  return timer;
}

async function releaseReconcileLock(lockKey: string): Promise<void> {
  const redis = await getRedisForLock();
  if (!redis) return;
  await redis.del(lockKey);
}

// ── GET /system/reconcile ─────────────────────────────────────
/**
 * @openapi
 * /system/reconcile:
 *   get:
 *     tags: [System]
 *     summary: 執行 Accountant ↔ Finance 對帳
 *     description: 比對帳本帳務紀錄與貸款譋明長期支出，輸出差異項目與行動清單
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, example: '202604', description: 'YYYYMM 格式，空白=全期間' }
 *       - in: query
 *         name: entity_type
 *         schema: { type: string, description: '實體 ID，空白=全實體' }
 *     responses:
 *       200:
 *         description: 對帳報告（MATCHED/DISCREPANCY）
 *   post:
 *     tags: [System]
 *     summary: 手動觸發全量對帳
 *     description: 商業觸發對帳，可選擇將結果寫入 Firestore 歷史紀錄
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               period: { type: string, example: '202604' }
 *               entity_type: { type: string }
 *               persist: { type: boolean, default: false, description: '是否寫入 Firestore 歷史' }
 *     responses:
 *       200:
 *         description: 對帳報告（含是否已寫入 Firestore）
 */
reconcileRouter.get('/', async (req: Request, res: Response) => {
  const { period, entity_type } = req.query as {
    period?: string;
    entity_type?: string;
  };

  logger.info(`[Reconcile/GET] period=${period ?? 'all'} entity=${entity_type ?? 'all'}`);

  try {
    const report = await performReconciliation(
      period,
      entity_type as EntityType | undefined,
    );

    res.json({
      ok: true,
      ...report,
      _disclaimer: '對帳結果僅供內部管理參考，以實際銀行對帳單為準',
    });
  } catch (err) {
    logger.error(`[Reconcile] Error: ${err}`);
    res.status(500).json({ error: '對帳引擎異常', details: String(err) });
  }
});

// ── POST /system/reconcile ────────────────────────────────────
reconcileRouter.post('/', async (req: Request, res: Response) => {
  const { period, entity_type, persist } = req.body as {
    period?: string;
    entity_type?: EntityType;
    persist?: boolean;
  };

  logger.info(`[Reconcile/POST] period=${period ?? 'all'} entity=${entity_type ?? 'all'} persist=${persist}`);

  // A-04: Acquire distributed lock with renewal support
  const lockPeriod = period ?? 'all';
  const lockEntity = entity_type ?? 'all';
  const { acquired: lockAcquired, lockKey } = await acquireReconcileLock(lockPeriod, lockEntity);
  if (!lockAcquired) {
    res.status(409).json({
      ok: false,
      code: 'RECONCILE_IN_PROGRESS',
      message: `對帳 ${lockPeriod}/${lockEntity} 正在進行中，請稍後再試`,
    });
    return;
  }

  // A-04: Start lock renewal to handle long-running reconciliation
  const renewalTimer = await startLockRenewal(lockKey);

  try {
    const report = await performReconciliation(period, entity_type);

    // 可選：寫入 Firestore 作為歷史紀錄
    if (persist) {
      try {
        const { getDb } = await import('../firestore-client');
        const db = getDb();
        if (db) {
          await db.collection('reconciliation_history').add({
            ...report,
            persisted_at: new Date().toISOString(),
          });
          logger.info('[Reconcile] Report persisted to Firestore');
        }
      } catch (fsErr) {
        logger.warn(`[Reconcile] Firestore persist failed: ${fsErr}`);
      }
    }

    res.json({
      ok: true,
      persisted: !!persist,
      ...report,
      _disclaimer: '對帳結果僅供內部管理參考，以實際銀行對帳單為準',
    });
  } catch (err) {
    logger.error(`[Reconcile] Error: ${err}`);
    res.status(500).json({ error: '對帳引擎異常', details: String(err) });
  } finally {
    // A-04: Stop renewal timer and release lock
    if (renewalTimer) clearInterval(renewalTimer);
    await releaseReconcileLock(lockKey);
  }
});

// ── GET /system/reconcile/summary ────────────────────────────
/**
 * @openapi
 * /system/reconcile/summary:
 *   get:
 *     tags: [System]
 *     summary: 對帳摘要（Dashboard Badge 用）
 *     description: 對帳結果精簡版，僅回傳配/不配數量、總差異和前 3 項行動
 *     security: [{ FirebaseAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string }
 *       - in: query
 *         name: entity_type
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 對帳摘要（API Badge 用）
 */
reconcileRouter.get('/summary', async (req: Request, res: Response) => {
  const { period, entity_type } = req.query as {
    period?: string;
    entity_type?: string;
  };

  try {
    const report = await performReconciliation(
      period,
      entity_type as EntityType | undefined,
    );

    // 精簡版（Dashboard Badge 用）
    const matched = report.items.filter(i => i.status === 'MATCHED').length;
    const issues = report.items.filter(i => i.status !== 'MATCHED').length;

    res.json({
      ok: true,
      overall_status: report.overall_status,
      period: report.period,
      matched_count: matched,
      issue_count: issues,
      total_delta: report.total_delta,
      ledger_total: report.ledger_total,
      loan_total: report.loan_total,
      top_actions: report.action_items.slice(0, 3),
      executed_at: report.executed_at,
    });
  } catch (err) {
    res.status(500).json({ error: '對帳異常', details: String(err) });
  }
});
