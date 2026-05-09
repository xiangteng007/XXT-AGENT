/**
 * chroma-memory.service.ts — v9.0 RAG 語義記憶服務 (ChromaDB)
 *
 * 設計：
 *   - 每個 Agent 獨立 ChromaDB Collection（隔離記憶空間）
 *   - 語義相似度查詢（向量搜索）+ 時間衰減（近期記憶權重更高）
 *   - Firestore 短期記憶 fallback（ChromaDB 不可用時）
 *   - 通過 Tailscale Funnel 連接 NAS 上的 ChromaDB
 *
 * 環境變數：
 *   CHROMADB_URL    — ChromaDB HTTP endpoint (e.g., https://nas.ts.net:8000)
 *   CHROMADB_TOKEN  — Bearer token 認證
 *
 * 使用示例：
 * ```ts
 * await chromaMemory.store('nova', 'user-123', 'Nova 說：請記住我的生日是 12/25');
 * const memories = await chromaMemory.query('nova', 'user-123', '我的生日是什麼時候?');
 * ```
 */

import { logger } from './logger';

// ── 型別定義 ──────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  agentId: string;
  userId: string;
  content: string;
  embedding?: number[];
  metadata: {
    timestamp: string;
    source: 'telegram' | 'api' | 'cron' | 'system';
    importance: number; // 0-1 重要性評分
    tags?: string[];
  };
}

export interface MemoryQueryResult {
  id: string;
  content: string;
  similarity: number;
  metadata: MemoryEntry['metadata'];
}

// ChromaDB HTTP API 回應格式
interface ChromaQueryResponse {
  ids: string[][];
  documents: (string | null)[][];
  metadatas: (Record<string, unknown> | null)[][];
  distances: number[][];
}

interface ChromaAddRequest {
  ids: string[];
  documents: string[];
  metadatas: Record<string, unknown>[];
  embeddings?: number[][];
}

// ── Embedding 生成（含 LRU 快取）─────────────────────────────────

const EMBED_MODEL = process.env['OLLAMA_EMBED_MODEL'] ?? 'nomic-embed-text';
const OLLAMA_URL = (process.env['OLLAMA_BASE_URL'] ?? process.env['LOCAL_RUNNER_BASE_URL'] ?? 'http://localhost:11434').replace(/\/$/, '');

/** Embedding LRU 快取 — 避免對相同文字重複呼叫 Ollama */
const EMBED_CACHE_MAX = 200;
const EMBED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分鐘
const embedCache = new Map<string, { vec: number[]; ts: number }>();

function pruneEmbedCache(): void {
  const now = Date.now();
  // 清除過期 entries
  for (const [key, val] of embedCache) {
    if (now - val.ts > EMBED_CACHE_TTL_MS) embedCache.delete(key);
  }
  // LRU eviction: 如果超過上限，刪除最舊的
  if (embedCache.size > EMBED_CACHE_MAX) {
    const oldest = embedCache.keys().next().value;
    if (oldest) embedCache.delete(oldest);
  }
}

/**
 * 透過 Ollama 的 nomic-embed-text 生成向量 embedding
 * NAS ChromaDB 沒有 server-side embedding，必須在 gateway 端生成
 * 內建 LRU 快取：相同文字在 TTL 內不重複生成
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // 快取命中
  const cacheKey = text.slice(0, 500); // 截斷避免超長 key
  const cached = embedCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < EMBED_CACHE_TTL_MS) {
    return cached.vec;
  }

  const resp = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    throw new Error(`Ollama embed failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as { embeddings: number[][] };
  if (!data.embeddings?.[0]) {
    throw new Error('Ollama embed returned empty embeddings');
  }

  const vec = data.embeddings[0];

  // 寫入快取
  embedCache.set(cacheKey, { vec, ts: Date.now() });
  pruneEmbedCache();

  return vec;
}

// ── 服務實作 ──────────────────────────────────────────────────

class ChromaMemoryService {
  private baseUrl: string;
  private token: string | null;
  private tenant: string;
  private database: string;
  private isAvailable: boolean | null = null; // null = 未測試
  private lastAvailabilityCheck = 0;
  private readonly AVAILABILITY_CACHE_MS = 60_000; // 1 分鐘緩存
  private collectionIdCache = new Map<string, string>(); // name → UUID cache

  constructor() {
    this.baseUrl = (process.env['CHROMADB_URL'] ?? 'http://localhost:8000').replace(/\/$/, '');
    this.token = process.env['CHROMADB_TOKEN'] ?? null;
    this.tenant = process.env['CHROMADB_TENANT'] ?? 'default_tenant';
    this.database = process.env['CHROMADB_DATABASE'] ?? 'default_database';
  }

  // ── 可用性檢測 ────────────────────────────────────────────

  private async checkAvailability(): Promise<boolean> {
    const now = Date.now();
    if (this.isAvailable !== null && now - this.lastAvailabilityCheck < this.AVAILABILITY_CACHE_MS) {
      return this.isAvailable;
    }

    try {
      const resp = await fetch(`${this.baseUrl}/api/v2/heartbeat`, {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      this.isAvailable = resp.ok;
    } catch {
      this.isAvailable = false;
    }

    this.lastAvailabilityCheck = now;

    if (!this.isAvailable) {
      logger.warn('[ChromaMemory] ChromaDB unavailable, falling back to Firestore');
    }

    return this.isAvailable;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // ── Collection 管理 ───────────────────────────────────────

  private getCollectionName(agentId: string): string {
    // 格式：xxt_{agentId}_memories（Chroma 不允許特殊字符）
    return `xxt_${agentId.replace(/[^a-z0-9]/g, '_')}_memories`;
  }

  /** v2 API base path: /api/v2/tenants/{tenant}/databases/{database} */
  private get dbPath(): string {
    return `${this.baseUrl}/api/v2/tenants/${this.tenant}/databases/${this.database}`;
  }

  /**
   * 確保 collection 存在，並返回 UUID
   * ChromaDB v2 API 的 add/query 需要用 UUID 而非 name
   */
  private async ensureCollection(collectionName: string): Promise<string | null> {
    // 快取
    const cached = this.collectionIdCache.get(collectionName);
    if (cached) return cached;

    try {
      // 先嘗試 GET，不存在則 POST 建立
      const getResp = await fetch(`${this.dbPath}/collections/${collectionName}`, {
        headers: this.buildHeaders(),
      });

      if (getResp.ok) {
        const data = await getResp.json() as { id: string };
        this.collectionIdCache.set(collectionName, data.id);
        return data.id;
      }

      // 建立新 collection（v2 API）
      const createResp = await fetch(`${this.dbPath}/collections`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          name: collectionName,
          metadata: { 'hnsw:space': 'cosine' },
        }),
      });

      if (createResp.ok) {
        const data = await createResp.json() as { id: string };
        this.collectionIdCache.set(collectionName, data.id);
        return data.id;
      }

      return null;
    } catch (err) {
      logger.warn(`[ChromaMemory] Failed to ensure collection ${collectionName}: ${err}`);
      return null;
    }
  }

  // ── 核心 CRUD ─────────────────────────────────────────────

  /**
   * 儲存記憶到 ChromaDB
   * @param agentId   Agent 識別符（例如 'nova', 'argus'）
   * @param userId    使用者 Firebase UID
   * @param content   要記憶的文字內容
   * @param options   重要性評分、標籤、來源
   */
  public async store(
    agentId: string,
    userId: string,
    content: string,
    options: {
      importance?: number;
      tags?: string[];
      source?: MemoryEntry['metadata']['source'];
    } = {},
  ): Promise<string | null> {
    const available = await this.checkAvailability();
    if (!available) {
      return this.storeToFirestore(agentId, userId, content, options);
    }

    const collectionName = this.getCollectionName(agentId);
    const collectionId = await this.ensureCollection(collectionName);
    if (!collectionId) {
      logger.warn(`[ChromaMemory] Failed to ensure collection ${collectionName}`);
      return this.storeToFirestore(agentId, userId, content, options);
    }

    const entryId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const metadata = {
      agentId,
      userId,
      timestamp: new Date().toISOString(),
      source: options.source ?? 'api',
      importance: options.importance ?? 0.5,
      tags: (options.tags ?? []).join(','),
    };

    // 生成 embedding（NAS ChromaDB 無 server-side embedding）
    let embedding: number[];
    try {
      embedding = await generateEmbedding(content);
    } catch (embedErr) {
      logger.warn(`[ChromaMemory] Embedding generation failed, falling back to Firestore: ${embedErr}`);
      return this.storeToFirestore(agentId, userId, content, options);
    }

    const body: ChromaAddRequest = {
      ids: [entryId],
      documents: [content],
      metadatas: [metadata],
      embeddings: [embedding],
    };

    try {
      const resp = await fetch(`${this.dbPath}/collections/${collectionId}/add`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        throw new Error(`ChromaDB add failed: ${resp.status} ${resp.statusText}`);
      }

      logger.info(`[ChromaMemory] Stored memory ${entryId} for ${agentId}/${userId}`);
      return entryId;
    } catch (err) {
      logger.warn(`[ChromaMemory] Store failed, falling back to Firestore: ${err}`);
      return this.storeToFirestore(agentId, userId, content, options);
    }
  }

  /**
   * 語義相似度查詢記憶
   * @param agentId    Agent 識別符
   * @param userId     使用者 Firebase UID（限制查詢範圍）
   * @param query      查詢文字
   * @param limit      最多返回條目數（預設 5）
   */
  public async query(
    agentId: string,
    userId: string,
    query: string,
    limit = 5,
  ): Promise<MemoryQueryResult[]> {
    const available = await this.checkAvailability();
    if (!available) {
      return this.queryFromFirestore(agentId, userId, limit);
    }

    const collectionName = this.getCollectionName(agentId);

    try {
      // 取得 collection UUID
      const collectionId = await this.ensureCollection(collectionName);
      if (!collectionId) {
        return this.queryFromFirestore(agentId, userId, limit);
      }

      // 生成查詢向量（NAS ChromaDB 無 server-side embedding）
      let queryEmbedding: number[];
      try {
        queryEmbedding = await generateEmbedding(query);
      } catch (embedErr) {
        logger.warn(`[ChromaMemory] Query embedding generation failed: ${embedErr}`);
        return this.queryFromFirestore(agentId, userId, limit);
      }

      const body = {
        query_embeddings: [queryEmbedding],
        n_results: limit,
        where: { userId }, // 用 userId 過濾，只查詢當前使用者的記憶
      };

      const resp = await fetch(`${this.dbPath}/collections/${collectionId}/query`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        if (resp.status === 404) return []; // Collection 不存在 = 無記憶
        throw new Error(`ChromaDB query failed: ${resp.status}`);
      }

      const data: ChromaQueryResponse = await resp.json() as ChromaQueryResponse;

      const results: MemoryQueryResult[] = [];
      const ids = data.ids[0] ?? [];
      const docs = data.documents[0] ?? [];
      const metas = data.metadatas[0] ?? [];
      const distances = data.distances[0] ?? [];

      for (let i = 0; i < ids.length; i++) {
        const meta = metas[i] as Record<string, unknown> ?? {};
        results.push({
          id: ids[i]!,
          content: docs[i] ?? '',
          // Chroma 返回的是距離（0 = 完全相同），轉換為相似度（1 = 完全相同）
          similarity: Math.max(0, 1 - (distances[i] ?? 1)),
          metadata: {
            timestamp: String(meta['timestamp'] ?? ''),
            source: String(meta['source'] ?? 'api') as MemoryEntry['metadata']['source'],
            importance: Number(meta['importance'] ?? 0.5),
            tags: meta['tags'] ? String(meta['tags']).split(',').filter(Boolean) : [],
          },
        });
      }

      // 依時間衰減調整分數：最近的記憶獲得額外加權
      const now = Date.now();
      results.forEach((r) => {
        const age = now - new Date(r.metadata.timestamp).getTime();
        const ageDays = age / (1000 * 60 * 60 * 24);
        const recencyBonus = Math.exp(-ageDays / 30); // 30 天半衰期
        r.similarity = r.similarity * 0.7 + recencyBonus * 0.3;
      });

      // 重新排序
      results.sort((a, b) => b.similarity - a.similarity);

      return results;
    } catch (err) {
      logger.warn(`[ChromaMemory] Query failed, falling back to Firestore: ${err}`);
      return this.queryFromFirestore(agentId, userId, limit);
    }
  }

  // ── Firestore Fallback ────────────────────────────────────

  private async storeToFirestore(
    agentId: string,
    userId: string,
    content: string,
    options: { importance?: number; tags?: string[]; source?: string },
  ): Promise<string | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getDb } = require('./firestore-client') as typeof import('./firestore-client');
      const db = getDb();
      if (!db) return null;

      const entryId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await db.collection(`_memory_${agentId}`).doc(entryId).set({
        id: entryId,
        agentId,
        userId,
        content,
        importance: options.importance ?? 0.5,
        tags: options.tags ?? [],
        source: options.source ?? 'api',
        timestamp: new Date().toISOString(),
      });

      return entryId;
    } catch (err) {
      logger.error(`[ChromaMemory] Firestore fallback store failed: ${err}`);
      return null;
    }
  }

  private async queryFromFirestore(
    agentId: string,
    userId: string,
    limit: number,
  ): Promise<MemoryQueryResult[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getDb } = require('./firestore-client') as typeof import('./firestore-client');
      const db = getDb();
      if (!db) return [];

      const snap = await db
        .collection(`_memory_${agentId}`)
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          content: String(data['content'] ?? ''),
          similarity: 0.5, // Firestore 不支援語義搜索，返回固定分數
          metadata: {
            timestamp: String(data['timestamp'] ?? ''),
            source: String(data['source'] ?? 'api') as MemoryEntry['metadata']['source'],
            importance: Number(data['importance'] ?? 0.5),
            tags: data['tags'] ?? [],
          },
        };
      });
    } catch (err) {
      logger.error(`[ChromaMemory] Firestore fallback query failed: ${err}`);
      return [];
    }
  }

  // ── 狀態查詢 ──────────────────────────────────────────────

  public async getStatus(): Promise<{ available: boolean; url: string; authenticated: boolean }> {
    const available = await this.checkAvailability();
    return {
      available,
      url: this.baseUrl,
      authenticated: Boolean(this.token),
    };
  }
}

// ── Singleton 導出 ────────────────────────────────────────────

export const chromaMemory = new ChromaMemoryService();
