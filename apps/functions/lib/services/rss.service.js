"use strict";
/**
 * RSS Parser Service
 *
 * Fetches and parses RSS feeds for news collection.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAllRssFeeds = fetchAllRssFeeds;
exports.deduplicateItems = deduplicateItems;
const v2_1 = require("firebase-functions/v2");
const rss_parser_1 = __importDefault(require("rss-parser"));
const parser = new rss_parser_1.default({
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
async function fetchAllRssFeeds() {
    const results = [];
    for (const feed of RSS_FEEDS) {
        try {
            v2_1.logger.info(`Fetching RSS: ${feed.name} (${feed.url})`);
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
            v2_1.logger.info(`Parsed ${data.items.length} items from ${feed.name}`);
        }
        catch (error) {
            v2_1.logger.warn(`Failed to fetch ${feed.name}: ${error}`);
        }
    }
    v2_1.logger.info(`Total RSS items fetched: ${results.length}`);
    return results;
}
/**
 * Check if an item is a duplicate based on URL
 */
function deduplicateItems(items, existingUrls) {
    const unique = [];
    const seenUrls = new Set();
    for (const item of items) {
        if (!existingUrls.has(item.link) && !seenUrls.has(item.link)) {
            unique.push(item);
            seenUrls.add(item.link);
        }
    }
    v2_1.logger.info(`Deduplicated: ${items.length} -> ${unique.length} items`);
    return unique;
}
//# sourceMappingURL=rss.service.js.map