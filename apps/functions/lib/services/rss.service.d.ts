/**
 * RSS Parser Service
 *
 * Fetches and parses RSS feeds for news collection.
 */
export interface RssItem {
    title: string;
    link: string;
    pubDate?: string;
    summary?: string;
    source: string;
}
/**
 * Fetch and parse all configured RSS feeds
 */
export declare function fetchAllRssFeeds(): Promise<RssItem[]>;
/**
 * Check if an item is a duplicate based on URL
 */
export declare function deduplicateItems(items: RssItem[], existingUrls: Set<string>): RssItem[];
//# sourceMappingURL=rss.service.d.ts.map