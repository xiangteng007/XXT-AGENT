"use strict";
/**
 * RAG Context Service �?Retrieval-Augmented Generation
 *
 * 閉合 ChromaDB �?Ollama 的記憶注入迴路�? *
 * 搜尋兩�?ChromaDB collection�? *   - xxt_agent_memories   : 使用者偏好、重要事實、對話片�? *   - training_knowledge   : Gemini 過去的高品質答案（知識蒸餾）
 *
 * 回傳格式化的 context 字串，可直接附加�?Ollama system prompt�? * 任何 ChromaDB 錯誤都靜默降級，不影響主流程�? */
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveRAGContext = retrieveRAGContext;
const v2_1 = require("firebase-functions/v2");
const local_inference_service_1 = require("./local-inference.service");
// ──────────────────────────────────────────────
// ChromaDB 連線 (對齊 memory-store.service.ts)
// ──────────────────────────────────────────────
const CHROMADB_BASE_URL = (process.env.CHROMADB_URL || 'http://192.168.31.77:8001').replace(/\/$/, '');
const CHROMADB_AUTH_TOKEN = process.env.CHROMADB_TOKEN || '';
const CHROMADB_TENANT = 'default_tenant';
const CHROMADB_DATABASE = 'default_database';
const CHROMA_API = `${CHROMADB_BASE_URL}/api/v2`;
/** Distance threshold �?距離 > 0.55 視為不相關，捨棄 */
const RELEVANCE_THRESHOLD = 0.55;
// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function chromaHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (CHROMADB_AUTH_TOKEN)
        h['Authorization'] = `Bearer ${CHROMADB_AUTH_TOKEN}`;
    return h;
}
async function queryCollection(collectionName, queryText, userId, nResults) {
    // Resolve collection ID
    const getResp = await fetch(`${CHROMA_API}/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections/${collectionName}`, { headers: chromaHeaders(), signal: AbortSignal.timeout(5000) });
    if (!getResp.ok)
        return [];
    const col = await getResp.json();
    const collectionId = col.id;
    // Vector query — use Ollama embedding if available for consistency with saveMemory
    const ollamaUp = await (0, local_inference_service_1.isOllamaAvailable)();
    const queryEmbedding = ollamaUp ? await (0, local_inference_service_1.embedText)(queryText).catch(() => null) : null;
    const queryPayload = {
        n_results: nResults,
        where: { userId },
        include: ['documents', 'metadatas', 'distances'],
    };
    if (queryEmbedding) {
        queryPayload.query_embeddings = [queryEmbedding];
    }
    else {
        queryPayload.query_texts = [queryText];
    }
    const qResp = await fetch(`${CHROMA_API}/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections/${collectionId}/query`, {
        method: 'POST',
        headers: chromaHeaders(),
        body: JSON.stringify(queryPayload),
        signal: AbortSignal.timeout(5000),
    });
    if (!qResp.ok)
        return [];
    const data = await qResp.json();
    const docs = data.documents?.[0] || [];
    const distances = data.distances?.[0] || [];
    const metas = data.metadatas?.[0] || [];
    const source = collectionName === 'xxt_agent_memories' ? 'memory' : 'training';
    return docs
        .map((doc, i) => ({
        content: doc,
        source,
        distance: distances[i] ?? 1,
        createdAt: Number(metas[i]?.['createdAt'] || 0),
    }))
        .filter(r => r.distance <= RELEVANCE_THRESHOLD && r.content.trim().length > 0);
}
// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────
/**
 * 取回與當前問題最相關的長期記憶，格式化為可直接注�?Ollama 的字串�? *
 * @param userId   Firebase / Telegram userId
 * @param query    使用者的原始訊息（用於向量搜尋）
 * @param agentId  active agent，用�?logging
 * @returns 格式化的 context 字串；ChromaDB 離線時回傳空字串
 */
async function retrieveRAGContext(userId, query, agentId = 'butler') {
    try {
        // 並行搜尋兩�?collection (各取 3 筆，合計最�?6 �?
        const [memoryHits, trainingHits] = await Promise.all([
            queryCollection('xxt_agent_memories', query, userId, 3).catch(() => []),
            queryCollection('training_knowledge', query, userId, 3).catch(() => []),
        ]);
        const allHits = [...memoryHits, ...trainingHits];
        if (allHits.length === 0) {
            v2_1.logger.info(`[RAG] No relevant memories for agent=${agentId} user=${userId}`);
            return '';
        }
        // 依相關性排序（distance 越小越相關），取�?5 �?        allHits.sort((a, b) => a.distance - b.distance);
        const top = allHits.slice(0, 5);
        v2_1.logger.info(`[RAG] Retrieved ${top.length} memories ` +
            `(mem=${memoryHits.length}, train=${trainingHits.length}) ` +
            `agent=${agentId} user=${userId}`);
        // 格式化為 Ollama 可讀�?context block
        const lines = top.map(hit => {
            const age = hit.createdAt ? formatAge(hit.createdAt) : '';
            const tag = hit.source === 'training' ? '📚 知識庫' : '💬 記憶';
            return `${tag}${age}: ${hit.content.slice(0, 300)}`;
        });
        return ('\n\n--- 相關長期記憶 ---\n' +
            lines.join('\n') +
            '\n--- 記憶結束 ---\n');
    }
    catch (err) {
        // 靜默降級 �?ChromaDB 離線不影響主流程
        v2_1.logger.warn('[RAG] retrieveRAGContext failed (graceful degrade):', err instanceof Error ? err.message : err);
        return '';
    }
}
// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function formatAge(createdAtMs) {
    const diffMs = Date.now() - createdAtMs;
    const days = Math.floor(diffMs / 86_400_000);
    if (days === 0)
        return ' (今天)';
    if (days === 1)
        return ' (昨天)';
    if (days < 7)
        return ` (${days}天前)`;
    if (days < 30)
        return ` (${Math.floor(days / 7)}週前)`;
    return ` (${Math.floor(days / 30)}個月�?`;
}
//# sourceMappingURL=rag-context.service.js.map