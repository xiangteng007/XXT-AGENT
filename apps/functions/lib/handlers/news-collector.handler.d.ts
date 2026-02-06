/**
 * News Collector Handler
 *
 * Scheduled function to collect news from RSS feeds
 * and store in Firestore for dashboard display.
 */
/**
 * Main handler for scheduled news collection
 */
export declare function handleNewsCollector(): Promise<{
    ok: boolean;
    fetched: number;
    written: number;
    skipped: number;
}>;
//# sourceMappingURL=news-collector.handler.d.ts.map