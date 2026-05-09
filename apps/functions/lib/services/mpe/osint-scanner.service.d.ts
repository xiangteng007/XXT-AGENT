/**
 * OSINT Scanner Service — 財經輿情掃描 + 情緒評分
 *
 * 掃描來源：
 *   - MoneyDJ RSS
 *   - 鉅亨網 RSS
 *   - Reuters Asia RSS
 *   - PTT Stock 版（HTML 解析）
 *
 * 每則新聞由 Ollama (qwen3:14b) 評分：
 *   -100 (極度負面) → +100 (極度正面)
 *
 * 輸出：加權平均情緒分數 + 關鍵事件標記
 */
export interface NewsItem {
    title: string;
    summary: string;
    url: string;
    source: string;
    publishedAt: Date;
    sentiment?: number;
    tags?: string[];
    isKeyEvent?: boolean;
}
export interface SentimentReport {
    timestamp: Date;
    symbol?: string;
    overallScore: number;
    rawScore: number;
    newsCount: number;
    keyEvents: string[];
    topPositive: string;
    topNegative: string;
    breakdown: string;
}
export declare function runOsintScan(symbol?: string): Promise<SentimentReport>;
export declare function formatSentimentForPrompt(report: SentimentReport): string;
//# sourceMappingURL=osint-scanner.service.d.ts.map