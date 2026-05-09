"use strict";
/**
 * Memory Store Service �?Local-First Architecture (v8.0)
 *
 * 雙層記憶架構�? *   - 短期 (Short-Term) : Firestore �?即時對話歷史，低延遲
 *   - 長期 (Long-Term)  : ChromaDB (NAS 192.168.31.77:8001) �?向量語義記憶
 *
 * ChromaDB API: v2 (�?v1 已棄�?
 * 存取優先順序：ChromaDB 可用 �?長期向量記憶；ChromaDB 離線 �?靜默降級�?Firestore
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isChromaDbAvailable = isChromaDbAvailable;
exports.saveMemory = saveMemory;
exports.searchMemory = searchMemory;
exports.getRecentContext = getRecentContext;
exports.pruneExpiredMemories = pruneExpiredMemories;
exports.getMemorySystemStatus = getMemorySystemStatus;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const local_inference_service_1 = require("./local-inference.service");
const db = (0, firestore_1.getFirestore)();
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
let chromadbAvailableCache = null;
let chromadbLastCheck = 0;
const CHROMADB_CACHE_TTL_MS = 30_000; // 30s 快取
// ================================
// ChromaDB v2 Helpers
// ================================
function chromaHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (CHROMADB_AUTH_TOKEN)
        headers['Authorization'] = `Bearer ${CHROMADB_AUTH_TOKEN}`;
    return headers;
}
async function chromaFetch(path, init) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    try {
        return await fetch(`${CHROMA_API}${path}`, {
            ...init,
            headers: { ...chromaHeaders(), ...(init?.headers || {}) },
            signal: ctrl.signal,
        });
    }
    finally {
        clearTimeout(timeout);
    }
}
// ================================
// ChromaDB Health Check
// ================================
async function isChromaDbAvailable() {
    const now = Date.now();
    if (chromadbAvailableCache !== null && (now - chromadbLastCheck) < CHROMADB_CACHE_TTL_MS) {
        return chromadbAvailableCache;
    }
    try {
        const resp = await chromaFetch('/heartbeat');
        chromadbAvailableCache = resp.ok;
        chromadbLastCheck = Date.now();
        if (!resp.ok) {
            v2_1.logger.warn(`[MemoryStore] ChromaDB heartbeat returned ${resp.status}`);
        }
        return resp.ok;
    }
    catch (err) {
        chromadbAvailableCache = false;
        chromadbLastCheck = Date.now();
        v2_1.logger.warn('[MemoryStore] ChromaDB unreachable, falling back to Firestore:', err instanceof Error ? err.message : err);
        return false;
    }
}
// ================================
// Collection Management
// ================================
/** 建立 collection（idempotent�?*/
async function ensureChromaCollection() {
    try {
        // Try to get existing collection first
        const getResp = await chromaFetch(`/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections/${CHROMADB_COLLECTION}`);
        if (getResp.ok) {
            const col = await getResp.json();
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
            const col = await createResp.json();
            v2_1.logger.info(`[MemoryStore] Collection ready: ${col.id}`);
            return col.id;
        }
        return null;
    }
    catch (err) {
        v2_1.logger.warn('[MemoryStore] ensureChromaCollection error:', err instanceof Error ? err.message : err);
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
async function saveMemory(entry) {
    const memoryId = `${entry.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fullEntry = {
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
        savedAt: firestore_1.Timestamp.now(),
    });
    // Write to ChromaDB for high-importance entries
    if (fullEntry.importance >= 3) {
        const chromaOk = await isChromaDbAvailable();
        if (chromaOk) {
            try {
                const collectionId = await ensureChromaCollection();
                if (collectionId) {
                    const document = `[${entry.agentId}] ${entry.content}${entry.summary ? ' | 摘要: ' + entry.summary : ''}`;
                    // Generate embedding via Ollama nomic-embed-text (local-first)
                    const ollamaUp = await (0, local_inference_service_1.isOllamaAvailable)();
                    const embedding = ollamaUp ? await (0, local_inference_service_1.embedText)(document).catch(() => null) : null;
                    const addPayload = {
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
                    };
                    if (embedding) {
                        addPayload.embeddings = [embedding];
                        v2_1.logger.info('[MemoryStore] Using Ollama nomic-embed-text for embedding');
                    }
                    const resp = await chromaFetch(`/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections/${collectionId}/add`, {
                        method: 'POST',
                        body: JSON.stringify(addPayload),
                    });
                    if (resp.ok) {
                        v2_1.logger.info(`[MemoryStore] Saved to ChromaDB: ${memoryId}`);
                    }
                }
            }
            catch (err) {
                v2_1.logger.warn('[MemoryStore] ChromaDB write failed, Firestore fallback active:', err instanceof Error ? err.message : err);
            }
        }
    }
    return memoryId;
}
/**
 * 語義搜尋記憶
 * ChromaDB 可用 �?向量相似度搜�? * ChromaDB 離線 �?Firestore 關鍵字搜�? */
async function searchMemory(userId, query, options = {}) {
    const limit = options.limit || 5;
    const chromaOk = await isChromaDbAvailable();
    if (chromaOk) {
        try {
            const collectionId = await ensureChromaCollection();
            if (collectionId) {
                const where = { userId };
                if (options.agentId)
                    where['agentId'] = options.agentId;
                if (options.type)
                    where['type'] = options.type;
                if (options.minImportance)
                    where['importance'] = { '$gte': options.minImportance };
                // Use Ollama embedding for query if available
                const ollamaUp = await (0, local_inference_service_1.isOllamaAvailable)();
                const queryEmbed = ollamaUp ? await (0, local_inference_service_1.embedText)(query).catch(() => null) : null;
                const queryPayload = {
                    n_results: limit,
                    where: Object.keys(where).length > 1 ? where : { userId },
                    include: ['documents', 'metadatas', 'distances'],
                };
                if (queryEmbed) {
                    queryPayload.query_embeddings = [queryEmbed];
                }
                else {
                    queryPayload.query_texts = [query];
                }
                const resp = await chromaFetch(`/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections/${collectionId}/query`, {
                    method: 'POST',
                    body: JSON.stringify(queryPayload),
                });
                if (resp.ok) {
                    const data = await resp.json();
                    const ids = data.ids?.[0] || [];
                    const docs = data.documents?.[0] || [];
                    const metas = data.metadatas?.[0] || [];
                    const distances = data.distances?.[0] || [];
                    const results = ids.map((id, i) => {
                        const meta = metas[i];
                        return {
                            entry: {
                                id,
                                userId: String(meta['userId'] || userId),
                                agentId: String(meta['agentId'] || 'butler'),
                                content: String(docs[i] || ''),
                                type: meta['type'] || 'conversation',
                                importance: meta['importance'] || 1,
                                tags: String(meta['tags'] || '').split(',').filter(Boolean),
                                createdAt: Number(meta['createdAt'] || 0),
                            },
                            distance: distances[i],
                            relevanceScore: 1 - (distances[i] || 0),
                        };
                    });
                    v2_1.logger.info(`[MemoryStore] ChromaDB search: ${results.length} results`);
                    return results;
                }
            }
        }
        catch (err) {
            v2_1.logger.warn('[MemoryStore] ChromaDB search failed, falling back to Firestore:', err instanceof Error ? err.message : err);
        }
    }
    return searchMemoryFirestore(userId, query, options);
}
async function searchMemoryFirestore(userId, query, options) {
    try {
        const snap = await db
            .collection(`users/${userId}/memories`)
            .orderBy('createdAt', 'desc')
            .limit((options.limit || 5) * 3)
            .get();
        const queryLower = query.toLowerCase();
        return snap.docs
            .map(d => d.data())
            .filter(e => {
            if (options.agentId && e.agentId !== options.agentId)
                return false;
            if (options.type && e.type !== options.type)
                return false;
            if (options.minImportance && e.importance < options.minImportance)
                return false;
            return (e.content.toLowerCase().includes(queryLower) ||
                (e.summary || '').toLowerCase().includes(queryLower) ||
                (e.tags || []).some(t => queryLower.includes(t.toLowerCase())));
        })
            .slice(0, options.limit || 5)
            .map(e => ({ entry: e, relevanceScore: 0.5 }));
    }
    catch (err) {
        v2_1.logger.error('[MemoryStore] Firestore search error:', err);
        return [];
    }
}
/**
 * 取得最近對話記憶（用於 context injection�? */
async function getRecentContext(userId, agentId, limit = 10) {
    try {
        const snap = await db
            .collection(`users/${userId}/memories`)
            .where('agentId', '==', agentId)
            .where('type', '==', 'conversation')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snap.docs.map(d => d.data()).reverse();
    }
    catch (err) {
        v2_1.logger.error('[MemoryStore] getRecentContext error:', err);
        return [];
    }
}
/**
 * 刪除過期記憶
 */
async function pruneExpiredMemories(userId) {
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
        v2_1.logger.info(`[MemoryStore] Pruned ${snap.size} expired memories for ${userId}`);
        return snap.size;
    }
    catch (err) {
        v2_1.logger.error('[MemoryStore] pruneExpiredMemories error:', err);
        return 0;
    }
}
/**
 * 取得系統狀態快照（�?/memory 指令顯示�? */
async function getMemorySystemStatus() {
    const chromaDbOnline = await isChromaDbAvailable();
    return {
        chromaDbOnline,
        chromaDbUrl: CHROMADB_BASE_URL,
        firestoreActive: true,
        layer: chromaDbOnline ? 'dual' : 'firestore-only',
    };
}
//# sourceMappingURL=memory-store.service.js.map