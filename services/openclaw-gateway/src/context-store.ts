/**
 * ContextStore — PR-5: Deliberation 上下文儲存
 *
 * 分層架構：
 *   - L1: In-Memory Map（同 process，毫秒存取）
 *   - L2: Redis（TTL 24h，跨 instance，key = delib:{taskId}:turns）
 *   - L3: Firestore（長期保存 final summary，永不過期）
 *
 * 設計原則：
 *   - Redis 連線失敗 → 降級到 in-memory（永不拋出）
 *   - Firestore 保存只在 session 結束時執行（非熱路徑）
 *   - 所有操作皆有 2s timeout
 */

import { logger } from './logger';

// ── 型別 ──────────────────────────────────────────────────────

/** 一條討論發言 */
export interface DeliberationTurn {
    /** Agent ID */
    agent: string;
    /** L0 = 本地即時 / L1 = 本地模型 / L2 = 雲端仲裁 */
    tier: 'L0' | 'L1' | 'L2';
    /** 發言內容 */
    content: string;
    /** Unix ms */
    timestamp: number;
    /** 推理路徑：local / cloud */
    inference_route?: 'local' | 'cloud';
}

/** 單一 Deliberation Session 的上下文 */
export interface DelibSession {
    task_id: string;
    created_at: number;
    turns: DeliberationTurn[];
    /** 最終仲裁結果（L2 完成後填入）*/
    final_summary?: string;
    closed?: boolean;
}

// ── 環境設定 ─────────────────────────────────────────────────
const REDIS_URL    = process.env['REDIS_URL'] ?? null;        // redis://nas-ip:6379
const REDIS_TTL_S  = 24 * 60 * 60;                           // 24 小時
const GATEWAY_INGEST_URL = process.env['OPENCLAW_GATEWAY_URL']
    ? `${process.env['OPENCLAW_GATEWAY_URL']}/events/ingest`
    : null;

// ── L1: In-Memory ─────────────────────────────────────────────
const memoryStore = new Map<string, DelibSession>();

// ── L2: Redis（動態載入，避免強制依賴）────────────────────────
let redisClient: RedisClientLike | null = null;

interface RedisClientLike {
    setEx(key: string, ttl: number, value: string): Promise<unknown>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<unknown>;
    quit(): Promise<unknown>;
}

/** 初始化 Redis（懶初始化，失敗靜默降級）*/
async function getRedis(): Promise<RedisClientLike | null> {
    if (redisClient) return redisClient;
    if (!REDIS_URL) return null;

    try {
        // 動態 require（避免在無 redis 環境中崩潰）
        const { createClient } = await import('redis' as string) as {
            createClient: (opts: { url: string }) => RedisClientLike & {
                connect(): Promise<void>;
                on(event: string, cb: (e: unknown) => void): void;
            }
        };
        const client = createClient({ url: REDIS_URL });
        client.on('error', (e) => logger.warn('[ContextStore] Redis error', String(e)));
        await Promise.race([
            client.connect(),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Redis connect timeout')), 2000)),
        ]);
        redisClient = client;
        logger.info('[ContextStore] Redis connected');
    } catch (err) {
        logger.warn('[ContextStore] Redis unavailable, falling back to in-memory', String(err));
    }
    return redisClient;
}

function redisKey(taskId: string): string {
    return `delib:${taskId}:turns`;
}

// ── 主要 API ─────────────────────────────────────────────────

/**
 * 取得或建立一個 Deliberation Session
 */
export async function getSession(taskId: string): Promise<DelibSession> {
    // L1 hit
    const mem = memoryStore.get(taskId);
    if (mem) return mem;

    // L2 Redis hit
    try {
        const redis = await getRedis();
        if (redis) {
            const raw = await withTimeout(redis.get(redisKey(taskId)), 2000);
            if (raw) {
                const session = JSON.parse(raw) as DelibSession;
                memoryStore.set(taskId, session); // warm L1
                return session;
            }
        }
    } catch (err) {
        logger.warn('[ContextStore] Redis get failed', String(err));
    }

    // Create new
    const session: DelibSession = {
        task_id: taskId,
        created_at: Date.now(),
        turns: [],
    };
    memoryStore.set(taskId, session);
    return session;
}

/**
 * 追加一條發言到 session
 */
export async function appendTurn(
    taskId: string,
    turn: DeliberationTurn,
): Promise<DelibSession> {
    const session = await getSession(taskId);
    session.turns.push(turn);

    // 更新 L1
    memoryStore.set(taskId, session);

    // 異步更新 L2（fire-and-forget）
    void persistToRedis(taskId, session);

    return session;
}

/**
 * 關閉 session（填入 final_summary，持久化到 Firestore）
 */
export async function closeSession(
    taskId: string,
    finalSummary: string,
): Promise<DelibSession> {
    const session = await getSession(taskId);
    session.final_summary = finalSummary;
    session.closed = true;

    memoryStore.set(taskId, session);

    // 異步持久化（fire-and-forget）
    void Promise.allSettled([
        persistToRedis(taskId, session),
        persistToFirestore(taskId, session),
    ]);

    return session;
}

/**
 * 刪除 session（清理 L1 + L2）
 */
export async function deleteSession(taskId: string): Promise<void> {
    memoryStore.delete(taskId);
    try {
        const redis = await getRedis();
        if (redis) await withTimeout(redis.del(redisKey(taskId)), 2000);
    } catch { /* no-op */ }
}

// ── 內部工具 ─────────────────────────────────────────────────

async function persistToRedis(taskId: string, session: DelibSession): Promise<void> {
    try {
        const redis = await getRedis();
        if (!redis) return;
        await withTimeout(
            redis.setEx(redisKey(taskId), REDIS_TTL_S, JSON.stringify(session)),
            2000,
        );
    } catch (err) {
        logger.warn('[ContextStore] Redis persist failed', String(err));
    }
}

async function persistToFirestore(taskId: string, session: DelibSession): Promise<void> {
    try {
        // 動態 import firebase-admin（此模組在 Gateway 中已初始化）
        const { getFirestore } = await import('firebase-admin/firestore' as string) as {
            getFirestore: () => {
                collection: (name: string) => {
                    doc: (id: string) => {
                        set: (data: unknown, opts?: unknown) => Promise<unknown>
                    }
                }
            }
        };
        const db = getFirestore();
        await withTimeout(
            db.collection('delib_sessions').doc(taskId).set({
                task_id: session.task_id,
                created_at: new Date(session.created_at).toISOString(),
                closed_at: new Date().toISOString(),
                turns_count: session.turns.length,
                final_summary: session.final_summary ?? '',
            }, { merge: true }),
            3000,
        );
        logger.info(`[ContextStore] Session ${taskId} persisted to Firestore`);
    } catch (err) {
        logger.warn('[ContextStore] Firestore persist failed', String(err));
    }
}

/** 帶 timeout 的 Promise wrapper */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        p,
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Timeout ${ms}ms`)), ms)),
    ]);
}

// ── 統計（供 /health 端點使用）──────────────────────────────
export function getContextStoreStats(): {
    memory_sessions: number;
    redis_connected: boolean;
} {
    return {
        memory_sessions: memoryStore.size,
        redis_connected: redisClient !== null,
    };
}

// ────────────────────────────────────────────────────────────
void getRedis(); // 啟動時預熱 Redis 連線（非阻塞）
