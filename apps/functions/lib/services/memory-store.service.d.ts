/**
 * Memory Store Service �?Local-First Architecture (v8.0)
 *
 * 雙層記憶架構�? *   - 短期 (Short-Term) : Firestore �?即時對話歷史，低延遲
 *   - 長期 (Long-Term)  : ChromaDB (NAS 192.168.31.77:8001) �?向量語義記憶
 *
 * ChromaDB API: v2 (�?v1 已棄�?
 * 存取優先順序：ChromaDB 可用 �?長期向量記憶；ChromaDB 離線 �?靜默降級�?Firestore
 */
export interface MemoryEntry {
    id?: string;
    userId: string;
    agentId: string;
    content: string;
    summary?: string;
    type: 'conversation' | 'fact' | 'preference' | 'task';
    importance: 1 | 2 | 3 | 4 | 5;
    tags?: string[];
    createdAt: number;
    expiresAt?: number;
}
export interface MemorySearchResult {
    entry: MemoryEntry;
    distance?: number;
    relevanceScore?: number;
}
export declare function isChromaDbAvailable(): Promise<boolean>;
/**
 * 儲存記憶條目
 * 高重要�?(importance >= 3) �?同時寫入 ChromaDB + Firestore
 * 低重要�?�?僅寫�?Firestore
 */
export declare function saveMemory(entry: Omit<MemoryEntry, 'createdAt'>): Promise<string>;
/**
 * 語義搜尋記憶
 * ChromaDB 可用 �?向量相似度搜�? * ChromaDB 離線 �?Firestore 關鍵字搜�? */
export declare function searchMemory(userId: string, query: string, options?: {
    limit?: number;
    agentId?: string;
    type?: MemoryEntry['type'];
    minImportance?: number;
}): Promise<MemorySearchResult[]>;
/**
 * 取得最近對話記憶（用於 context injection�? */
export declare function getRecentContext(userId: string, agentId: string, limit?: number): Promise<MemoryEntry[]>;
/**
 * 刪除過期記憶
 */
export declare function pruneExpiredMemories(userId: string): Promise<number>;
/**
 * 取得系統狀態快照（�?/memory 指令顯示�? */
export declare function getMemorySystemStatus(): Promise<{
    chromaDbOnline: boolean;
    chromaDbUrl: string;
    firestoreActive: boolean;
    layer: 'dual' | 'firestore-only';
}>;
//# sourceMappingURL=memory-store.service.d.ts.map