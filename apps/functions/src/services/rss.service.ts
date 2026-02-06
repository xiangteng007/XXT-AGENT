/**
 * RSS Parser Service
 * 
 * Fetches and parses RSS feeds for news collection.
 */

import Parser from 'rss-parser';

export interface RssItem {
    title: string;
    link: string;
    pubDate?: string;
    summary?: string;
    source: string;
}

const parser = new Parser({
    timeout: 10000,
    maxRedirects: 3,
});

const RSS_FEEDS = [
    { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' },
    { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge' },
    { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
    { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', name: 'CNBC' },
    { url: 'https://feeds.feedburner.com/TheHackersNews', name: 'Hacker News' },
];

/**
 * Fetch and parse all configured RSS feeds
 */
export async function fetchAllRssFeeds(): Promise<RssItem[]> {
    const results: RssItem[] = [];

    for (const feed of RSS_FEEDS) {
        try {
            console.log(`Fetching RSS: ${feed.name} (${feed.url})`);
            const data = await parser.parseURL(feed.url);
            
            for (const item of data.items.slice(0, 20)) {
                if (item.link) {
                    results.push({
                        title: item.title || 'No title',
                        link: item.link,
                        pubDate: item.pubDate || item.isoDate,
                        summary: (item.contentSnippet || item.content || '').substring(0, 500),
                        source: feed.name,
                    });
                }
            }
            console.log(`Parsed ${data.items.length} items from ${feed.name}`);
        } catch (error) {
            console.warn(`Failed to fetch ${feed.name}: ${error}`);
        }
    }

    console.log(`Total RSS items fetched: ${results.length}`);
    return results;
}

/**
 * Check if an item is a duplicate based on URL
 */
export function deduplicateItems(
    items: RssItem[],
    existingUrls: Set<string>
): RssItem[] {
    const unique: RssItem[] = [];
    const seenUrls = new Set<string>();

    for (const item of items) {
        if (!existingUrls.has(item.link) && !seenUrls.has(item.link)) {
            unique.push(item);
            seenUrls.add(item.link);
        }
    }

    console.log(`Deduplicated: ${items.length} -> ${unique.length} items`);
    return unique;
}
