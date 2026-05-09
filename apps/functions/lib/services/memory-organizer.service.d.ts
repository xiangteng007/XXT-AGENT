/**
 * Memory Organizer Service — Local-First Memory Intelligence
 *
 * 三層記憶自動整理系統，全程在本地 Ollama (RTX 4080) 執行：
 *
 *   Layer A — 對話後萃取 (extractAndSaveFacts)
 *     每次對話結束後，讓 Ollama 從對話中萃取 fact / preference，
 *     自動寫入 ChromaDB，無需用戶明確觸發。
 *
 *   Layer B — 每日摘要 (runDailySummary)
 *     Cloud Scheduler 每日凌晨 2:00 觸發。
 *     彙整當日財務、健康、行程，產生結構化日報存入長期記憶。
 *
 *   Layer C — 跨域關聯洞察 (runCrossdomainInsights)
 *     每週日觸發，Ollama 觀察多個維度的關聯，
 *     主動產生行為洞察（如「加班日的消費習慣」）。
 *
 * 所有操作離線時靜默降級，不影響主流程。
 */
export interface ExtractedFact {
    type: 'fact' | 'preference';
    content: string;
    importance: 1 | 2 | 3 | 4 | 5;
    tags: string[];
}
export interface DailySummaryResult {
    userId: string;
    date: string;
    factsExtracted: number;
    summariesSaved: number;
    insightsGenerated: number;
    skippedReason?: string;
}
/**
 * Layer A: 從單次對話萃取事實/偏好並存入記憶
 * 在 butler-ai.service.ts 回應後非同步呼叫（不阻塞回應）
 */
export declare function extractAndSaveFacts(userId: string, agentId: string, userMessage: string, assistantReply: string): Promise<number>;
/**
 * Layer B: 每日摘要（Cloud Scheduler 呼叫）
 */
export declare function runDailySummary(userIds: string[]): Promise<DailySummaryResult[]>;
/**
 * Layer C: 跨域關聯洞察（每週執行）
 */
export declare function runCrossdomainInsights(userId: string): Promise<number>;
/**
 * 取得最近 7 天有活動的用戶 ID 列表
 */
export declare function getActiveUserIds(): Promise<string[]>;
//# sourceMappingURL=memory-organizer.service.d.ts.map