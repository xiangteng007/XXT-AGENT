/**
 * Memory Store Service �?Local-First Architecture (v8.0)
 *
 * 雙層記憶架構�? *   - 短期 (Short-Term) : Firestore �?即時對話歷史，低延遲
 *   - 長期 (Long-Term)  : ChromaDB (NAS 192.168.31.77:8001) �?向量語義記憶
 *
 * ChromaDB API: v2 (�?v1 已棄�?
 * 存取優先順序：ChromaDB 可用 �?長期向量記憶；ChromaDB 離線 �?靜默降級�?Firestore
 */

import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

// ================================
// ChromaDB 連線設定
// ================================

/** ChromaDB 端點 (NAS 192.168.31.77:8001 �?Tailscale URL) */
const CHROMADB_BASE_URL = (process.env.CHROMADB_URL || 'http://192.168.31.77:8001').replace(/\/$/, '');
const CHROMADB_AUTH_TOKEN = process.env.CHROMADB_TOKEN || '';
const CHROMADB_COLLECTION = 'xxt_agent_memories';
const CHROMADB_TENANT = 'default_tenant';
const CHROMADB_DATABASE = 'default_database';

/** ChromaDB v2 API 基礎路徑 */
const CHROMA_API = `${CHROMADB_BASE_URL}/api/v2`;

/** 快取 ChromaDB 連線狀態，避免每次請求都做健康檢查 */
let chromadbAvailableCache: boolean | null = null;
let chromadbLastCheck = 0;
const CHROMADB_CACHE_TTL_MS = 30_000; // 30s 快取

// ================================
// Types
// ================================

export interface MemoryEntry {
    id?: string;
    userId: string;
    agentId: string;
    content: string;
    summary?: string;
    type: 'conversation' | 'fact' | 'preference' | 'task';
    importance: 1 | 2 | 3 | 4 | 5; // 1=low, 5=critical
    tags?: string[];
    createdAt: number; // Unix timestamp ms
    expiresAt?: number; // Optional TTL
}

export interface MemorySearchResult {
    entry: MemoryEntry;
    distance?: number;
    relevanceScore?: number;
}

// ================================
// ChromaDB v2 Helpers
// ================================

function chromaHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (CHROMADB_AUTH_TOKEN) headers['Authorization'] = `Bearer ${CHROMADB_AUTH_TOKEN}`;
    return headers;
}

async function chromaFetch(path: string, init?: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    try {
        return await fetch(`${CHROMA_API}${path}`, {
            ...init,
            headers: { ...chromaHeaders(), ...(init?.headers as Record<string, string> || {}) },
            signal: ctrl.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}

// ================================
// ChromaDB Health Check
// ================================

export async function isChromaDbAvailable(): Promise<boolean> {
    const now = Date.now();
    if (chromadbAvailableCache !== null && (now - chromadbLastCheck) < CHROMADB_CACHE_TTL_MS) {
        return chromadbAvailableCache;
    }

    try {
        const resp = await chromaFetch('/heartbeat');
        chromadbAvailableCache = resp.ok;
        chromadbLastCheck = Date.now();
        if (!resp.ok) {
            logger.warn(`[MemoryStore] ChromaDB heartbeat returned ${resp.status}`);
        }
        return resp.ok;
    } catch (err) {
        chromadbAvailableCache = false;
        chromadbLastCheck = Date.now();
        logger.warn('[MemoryStore] ChromaDB unreachable, falling back to Firestore:', err instanceof Error ? err.message : err);
        return false;
    }
}

// ================================
// Collection Management
// ================================

/** 建立 collection（idempotent�?*/
async function ensureChromaCollection(): Promise<string | null> {
    try {
        // Try to get existing collection first
        const getResp = await chromaFetch(`/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections/${CHROMADB_COLLECTION}`);
        if (getResp.ok) {
            const col = await getResp.json() as { id: string };
            return col.id;
        }

        // Create if not exists
        const createResp = await chromaFetch(`/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections`, {
            method: 'POST',
            body: JSON.stringify({
                name: CHROMADB_COLLECTION,
                configuration: { hnsw: { space: 'cosine' } },
                get_or_create: true,
            }),
        });

        if (createResp.ok) {
            const col = await createResp.json() as { id: string };
            logger.info(`[MemoryStore] Collection ready: ${col.id}`);
            return col.id;
        }
        return null;
    } catch (err) {
        logger.warn('[MemoryStore] ensureChromaCollection error:', err instanceof Error ? err.message : err);
        return null;
    }
}

// ================================
// Core Memory Operations
// ================================

/**
 * 儲存記憶條目
 * 高重要�?(importance >= 3) �?同時寫入 ChromaDB + Firestore
 * 低重要�?�?僅寫�?Firestore
 */
export async function saveMemory(entry: Omit<MemoryEntry, 'createdAt'>): Promise<string> {
    const memoryId = `${entry.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fullEntry: MemoryEntry = {
        ...entry,
        id: memoryId,
        createdAt: Date.now(),
    };

    // Always write to Firestore (short-term, reliable)
    await db
        .collection(`users/${entry.userId}/memories`)
        .doc(memoryId)
        .set({
            ...fullEntry,
            savedAt: Timestamp.now(),
        });

    // Write to ChromaDB for high-importance entries
    if (fullEntry.importance >= 3) {
        const chromaOk = await isChromaDbAvailable();
        if (chromaOk) {
            try {
                const collectionId = await ensureChromaCollection();
                if (collectionId) {
                    const document = `[${entry.agentId}] ${entry.content}${entry.summary ? ' | 摘要: ' + entry.summary : ''}`;
                    const resp = await chromaFetch(
                        `/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections/${collectionId}/add`,
                        {
                            method: 'POST',
                            body: JSON.stringify({
                                ids: [memoryId],
                                documents: [document],
                                metadatas: [{
                                    userId: entry.userId,
                                    agentId: entry.agentId,
                                    type: entry.type,
                                    importance: entry.importance,
                                    tags: (entry.tags || []).join(','),
                                    createdAt: fullEntry.createdAt,
                                }],
                            }),
                        }
                    );
                    if (resp.ok) {
                        logger.info(`[MemoryStore] Saved to ChromaDB: ${memoryId}`);
                    }
                }
            } catch (err) {
                logger.warn('[MemoryStore] ChromaDB write failed, Firestore fallback active:', err instanceof Error ? err.message : err);
            }
        }
    }

    return memoryId;
}

/**
 * 語義搜尋記憶
 * ChromaDB 可用 �?向量相似度搜�? * ChromaDB 離線 �?Firestore 關鍵字搜�? */
export async function searchMemory(
    userId: string,
    query: string,
    options: {
        limit?: number;
        agentId?: string;
        type?: MemoryEntry['type'];
        minImportance?: number;
    } = {}
): Promise<MemorySearchResult[]> {
    const limit = options.limit || 5;
    const chromaOk = await isChromaDbAvailable();

    if (chromaOk) {
        try {
            const collectionId = await ensureChromaCollection();
            if (collectionId) {
                const where: Record<string, unknown> = { userId };
                if (options.agentId) where['agentId'] = options.agentId;
                if (options.type) where['type'] = options.type;
                if (options.minImportance) where['importance'] = { '$gte': options.minImportance };

                const resp = await chromaFetch(
                    `/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections/${collectionId}/query`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            query_texts: [query],
                            n_results: limit,
                            where: Object.keys(where).length > 1 ? where : { userId },
                            include: ['documents', 'metadatas', 'distances'],
                        }),
                    }
                );

                if (resp.ok) {
                    const data = await resp.json() as {
                        ids: string[][];
                        documents: string[][];
                        metadatas: Record<string, unknown>[][];
                        distances: number[][];
                    };

                    const ids = data.ids?.[0] || [];
                    const docs = data.documents?.[0] || [];
                    const metas = data.metadatas?.[0] || [];
                    const distances = data.distances?.[0] || [];

                    const results: MemorySearchResult[] = ids.map((id, i) => {
                        const meta = metas[i] as Record<string, unknown>;
                        return {
                            entry: {
                                id,
                                userId: String(meta['userId'] || userId),
                                agentId: String(meta['agentId'] || 'butler'),
                                content: String(docs[i] || ''),
                                type: (meta['type'] as MemoryEntry['type']) || 'conversation',
                                importance: (meta['importance'] as MemoryEntry['importance']) || 1,
                                tags: String(meta['tags'] || '').split(',').filter(Boolean),
                                createdAt: Number(meta['createdAt'] || 0),
                            },
                            distance: distances[i],
                            relevanceScore: 1 - (distances[i] || 0),
                        };
                    });

                    logger.info(`[MemoryStore] ChromaDB search: ${results.length} results`);
                    return results;
                }
            }
        } catch (err) {
            logger.warn('[MemoryStore] ChromaDB search failed, falling back to Firestore:', err instanceof Error ? err.message : err);
        }
    }

    return searchMemoryFirestore(userId, query, options);
}

async function searchMemoryFirestore(
    userId: string,
    query: string,
    options: { limit?: number; agentId?: string; type?: MemoryEntry['type']; minImportance?: number }
): Promise<MemorySearchResult[]> {
    try {
        const snap = await db
            .collection(`users/${userId}/memories`)
            .orderBy('createdAt', 'desc')
            .limit((options.limit || 5) * 3)
            .get();

        const queryLower = query.toLowerCase();

        return snap.docs
            .map(d => d.data() as MemoryEntry)
            .filter(e => {
                if (options.agentId && e.agentId !== options.agentId) return false;
                if (options.type && e.type !== options.type) return false;
                if (options.minImportance && e.importance < options.minImportance) return false;
                return (
                    e.content.toLowerCase().includes(queryLower) ||
                    (e.summary || '').toLowerCase().includes(queryLower) ||
                    (e.tags || []).some(t => queryLower.includes(t.toLowerCase()))
                );
            })
            .slice(0, options.limit || 5)
            .map(e => ({ entry: e, relevanceScore: 0.5 }));
    } catch (err) {
        logger.error('[MemoryStore] Firestore search error:', err);
        return [];
    }
}

/**
 * 取得最近對話記憶（用於 context injection�? */
export async function getRecentContext(
    userId: string,
    agentId: string,
    limit = 10
): Promise<MemoryEntry[]> {
    try {
        const snap = await db
            .collection(`users/${userId}/memories`)
            .where('agentId', '==', agentId)
            .where('type', '==', 'conversation')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        return snap.docs.map(d => d.data() as MemoryEntry).reverse();
    } catch (err) {
        logger.error('[MemoryStore] getRecentContext error:', err);
        return [];
    }
}

/**
 * 刪除過期記憶
 */
export async function pruneExpiredMemories(userId: string): Promise<number> {
    try {
        const now = Date.now();
        const snap = await db
            .collection(`users/${userId}/memories`)
            .where('expiresAt', '<=', now)
            .limit(50)
            .get();

        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        logger.info(`[MemoryStore] Pruned ${snap.size} expired memories for ${userId}`);
        return snap.size;
    } catch (err) {
        logger.error('[MemoryStore] pruneExpiredMemories error:', err);
        return 0;
    }
}

/**
 * 取得系統狀態快照（�?/memory 指令顯示�? */
export async function getMemorySystemStatus(): Promise<{
    chromaDbOnline: boolean;
    chromaDbUrl: string;
    firestoreActive: boolean;
    layer: 'dual' | 'firestore-only';
}> {
    const chromaDbOnline = await isChromaDbAvailable();
    return {
        chromaDbOnline,
        chromaDbUrl: CHROMADB_BASE_URL,
        firestoreActive: true,
        layer: chromaDbOnline ? 'dual' : 'firestore-only',
    };
}
