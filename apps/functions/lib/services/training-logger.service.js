"use strict";
/**
 * Training Logger Service
 *
 * 知識蒸餾管線 (Knowledge Distillation Pipeline)
 * ─────────────────────────────────────────────────────
 * 每次 Gemini (cloud) �?Ollama (local) 回應後，同時記錄�? *
 *   1. Firestore `training_logs`
 *      - 包含 Ollama 標準 JSONL 格式 (messages array)
 *      - 可直�?export �?`ollama create <model> --file training.jsonl`
 *      - 可用�?LoRA / QLoRA 微調 qwen3:14b / gpt-oss:20b
 *
 *   2. ChromaDB `training_knowledge` collection
 *      - 向量索引，即時可�?RAG 查詢
 *      - 讓本地模型在下次回答時能「知道」Gemini 曾怎麼回答
 *
 * 寫入策略：Fire-and-forget (不阻塞主回應流程)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordTrainingData = recordTrainingData;
exports.exportTrainingJSONL = exportTrainingJSONL;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
// ChromaDB 設定 (複用 memory-store 的環境變�?
const CHROMADB_BASE_URL = (process.env.CHROMADB_URL || 'http://192.168.31.77:8001').replace(/\/$/, '');
const CHROMADB_AUTH_TOKEN = process.env.CHROMADB_TOKEN || '';
const CHROMA_API = `${CHROMADB_BASE_URL}/api/v2`;
const TRAINING_COLLECTION_NAME = 'training_knowledge';
const CHROMADB_TENANT = 'default_tenant';
const CHROMADB_DATABASE = 'default_database';
// ============================================================================
// ChromaDB Helpers (獨立�?memory-store，使�?training 專屬 collection)
// ============================================================================
function chromaHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (CHROMADB_AUTH_TOKEN)
        h['Authorization'] = `Bearer ${CHROMADB_AUTH_TOKEN}`;
    return h;
}
async function chromaFetch(path, init) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
        return await fetch(`${CHROMA_API}${path}`, {
            ...init,
            headers: { ...chromaHeaders(), ...(init?.headers || {}) },
            signal: ctrl.signal,
        });
    }
    finally {
        clearTimeout(t);
    }
}
/** 確保 training_knowledge collection 存在，回�?collection ID */
async function ensureTrainingCollection() {
    try {
        const listResp = await chromaFetch(`/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections?name=${TRAINING_COLLECTION_NAME}`);
        if (listResp.ok) {
            const cols = await listResp.json();
            if (Array.isArray(cols) && cols.length > 0)
                return cols[0].id;
        }
        const createResp = await chromaFetch(`/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections`, {
            method: 'POST',
            body: JSON.stringify({
                name: TRAINING_COLLECTION_NAME,
                metadata: { description: 'AI training data for local model fine-tuning' },
            }),
        });
        if (createResp.ok) {
            const col = await createResp.json();
            v2_1.logger.info(`[Training] ChromaDB collection created: ${col.id}`);
            return col.id;
        }
        return null;
    }
    catch (err) {
        v2_1.logger.warn('[Training] ensureTrainingCollection error:', err instanceof Error ? err.message : err);
        return null;
    }
}
// ============================================================================
// Core: Record Training Data
// ============================================================================
/**
 * 記錄一筆訓練資料�? * Fire-and-forget �?呼叫方不需 await�? *
 * 寫入�? *   - Firestore: `training_logs/{autoId}`  (�?Ollama JSONL 格式)
 *   - ChromaDB : `training_knowledge`       (向量索引，RAG 可查)
 */
async function recordTrainingData(record) {
    const docId = `${record.agent}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    // Ollama 標準微調格式 (llama.cpp / unsloth 相容)
    const ollamaMessages = [
        { role: 'system', content: record.systemPrompt },
        { role: 'user', content: record.userMessage },
        { role: 'assistant', content: record.response },
    ];
    // ── 1. Firestore (primary, reliable) ─────────────────────────────────
    try {
        await db.collection('training_logs').doc(docId).set({
            // 原始欄位
            userId: record.userId,
            agent: record.agent,
            model: record.model,
            source: record.source,
            userMessage: record.userMessage,
            systemPrompt: record.systemPrompt,
            response: record.response,
            requiresLiveData: record.requiresLiveData,
            toolCalls: record.toolCalls || [],
            // Ollama JSONL (可直�?export �?fine-tune)
            ollamaMessages,
            // 匯出輔助欄位
            exportedAt: null, // 設為 null，表示尚未匯�?            qualityScore: null,   // 預留人工評分欄位
            savedAt: firestore_1.Timestamp.now(),
        });
        v2_1.logger.info(`[Training] Saved to Firestore: ${docId} source=${record.source}`);
    }
    catch (err) {
        v2_1.logger.warn('[Training] Firestore write failed:', err instanceof Error ? err.message : err);
    }
    // ── 2. ChromaDB (non-blocking, graceful fail) ─────────────────────────
    // 以 void 保持 fire-and-forget，不擋住主流程
    void (async () => {
        try {
            const collectionId = await ensureTrainingCollection();
            if (!collectionId)
                return;
            // �?Q&A 組合成可搜尋�?document
            const document = [
                `[${record.source}][${record.agent}]`,
                `Q: ${record.userMessage}`,
                `A: ${record.response}`,
            ].join('\n');
            const resp = await chromaFetch(`/tenants/${CHROMADB_TENANT}/databases/${CHROMADB_DATABASE}/collections/${collectionId}/add`, {
                method: 'POST',
                body: JSON.stringify({
                    ids: [docId],
                    documents: [document],
                    metadatas: [{
                            userId: record.userId,
                            agent: record.agent,
                            model: record.model,
                            source: record.source,
                            requiresLiveData: record.requiresLiveData,
                            hasToolCalls: (record.toolCalls?.length || 0) > 0,
                            createdAt: Date.now(),
                        }],
                }),
            });
            if (resp.ok) {
                v2_1.logger.info(`[Training] Saved to ChromaDB training_knowledge: ${docId}`);
            }
            else {
                const body = await resp.text();
                v2_1.logger.warn(`[Training] ChromaDB add failed (${resp.status}): ${body.slice(0, 100)}`);
            }
        }
        catch (err) {
            v2_1.logger.warn('[Training] ChromaDB write failed:', err instanceof Error ? err.message : err);
        }
    })();
}
// ============================================================================
// Export Helpers (for CLI / cron job to export JSONL for Ollama fine-tuning)
// ============================================================================
/**
 * �?Firestore 匯出指定條件的訓練資料，格式化為 JSONL 字串�? *
 * 使用方法�? *   const jsonl = await exportTrainingJSONL({ source: 'gemini-2.0-flash', limit: 500 });
 *   fs.writeFileSync('training.jsonl', jsonl);
 *   // 然後：ollama create xxt-butler:v1 --file Modelfile
 *
 * @param opts.source      過濾來源 (不填 = 全部)
 * @param opts.agent       過濾 agent (不填 = 全部)
 * @param opts.limit       最多幾�?(預設 1000)
 * @param opts.onlyExported 僅匯出尚未標記匯出的 (預設 false)
 */
async function exportTrainingJSONL(opts = {}) {
    const { source, agent, limit = 1000, markAsExported = false } = opts;
    let q = db.collection('training_logs')
        .orderBy('savedAt', 'desc')
        .limit(limit);
    if (source)
        q = q.where('source', '==', source);
    if (agent)
        q = q.where('agent', '==', agent);
    const snap = await q.get();
    const lines = [];
    const batch = db.batch();
    snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.ollamaMessages && Array.isArray(data.ollamaMessages)) {
            lines.push(JSON.stringify({ messages: data.ollamaMessages }));
            if (markAsExported) {
                batch.update(doc.ref, { exportedAt: firestore_1.Timestamp.now() });
            }
        }
    });
    if (markAsExported && lines.length > 0) {
        await batch.commit();
        v2_1.logger.info(`[Training] Marked ${lines.length} records as exported`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=training-logger.service.js.map