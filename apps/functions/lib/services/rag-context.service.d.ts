/**
 * RAG Context Service �?Retrieval-Augmented Generation
 *
 * 閉合 ChromaDB �?Ollama 的記憶注入迴路�? *
 * 搜尋兩�?ChromaDB collection�? *   - xxt_agent_memories   : 使用者偏好、重要事實、對話片�? *   - training_knowledge   : Gemini 過去的高品質答案（知識蒸餾）
 *
 * 回傳格式化的 context 字串，可直接附加�?Ollama system prompt�? * 任何 ChromaDB 錯誤都靜默降級，不影響主流程�? */
/**
 * 取回與當前問題最相關的長期記憶，格式化為可直接注�?Ollama 的字串�? *
 * @param userId   Firebase / Telegram userId
 * @param query    使用者的原始訊息（用於向量搜尋）
 * @param agentId  active agent，用�?logging
 * @returns 格式化的 context 字串；ChromaDB 離線時回傳空字串
 */
export declare function retrieveRAGContext(userId: string, query: string, agentId?: string): Promise<string>;
//# sourceMappingURL=rag-context.service.d.ts.map