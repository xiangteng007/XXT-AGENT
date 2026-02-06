"use strict";
/**
 * News Collector Handler
 *
 * Scheduled function to collect news from RSS feeds
 * and store in Firestore for dashboard display.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNewsCollector = handleNewsCollector;
const firestore_1 = require("firebase-admin/firestore");
const rss_service_1 = require("../services/rss.service");
const MARKET_NEWS_COLLECTION = 'market_news';
const RECENT_HOURS = 24; // Only keep URLs from last 24 hours for dedup
/**
 * Get recently seen URLs from Firestore (for deduplication)
 */
async function getRecentUrls() {
    const db = (0, firestore_1.getFirestore)();
    const cutoff = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000);
    const snapshot = await db.collection(MARKET_NEWS_COLLECTION)
        .where('ts', '>', firestore_1.Timestamp.fromDate(cutoff))
        .select('url')
        .get();
    const urls = new Set();
    snapshot.docs.forEach(doc => {
        const url = doc.data().url;
        if (url)
            urls.add(url);
    });
    console.log(`Found ${urls.size} recent URLs for deduplication`);
    return urls;
}
/**
 * Write news items to Firestore
 */
async function writeNewsToFirestore(items) {
    if (items.length === 0)
        return 0;
    const db = (0, firestore_1.getFirestore)();
    const batch = db.batch();
    const ts = firestore_1.Timestamp.now();
    let count = 0;
    for (const item of items.slice(0, 100)) { // Limit batch size
        const docRef = db.collection(MARKET_NEWS_COLLECTION).doc();
        batch.set(docRef, {
            headline: item.title,
            summary: item.summary || '',
            url: item.link,
            source: item.source,
            category: 'rss',
            ts: ts,
            pubDate: item.pubDate || null,
        });
        count++;
    }
    await batch.commit();
    console.log(`Wrote ${count} news items to Firestore`);
    return count;
}
/**
 * Main handler for scheduled news collection
 */
async function handleNewsCollector() {
    console.log('[News Collector] Starting collection...');
    try {
        // 1. Fetch RSS feeds
        const allItems = await (0, rss_service_1.fetchAllRssFeeds)();
        // 2. Get recent URLs for deduplication
        const recentUrls = await getRecentUrls();
        // 3. Deduplicate
        const newItems = (0, rss_service_1.deduplicateItems)(allItems, recentUrls);
        // 4. Write to Firestore
        const written = await writeNewsToFirestore(newItems);
        const result = {
            ok: true,
            fetched: allItems.length,
            written: written,
            skipped: allItems.length - newItems.length,
        };
        console.log('[News Collector] Complete:', result);
        return result;
    }
    catch (error) {
        console.error('[News Collector] Error:', error);
        return {
            ok: false,
            fetched: 0,
            written: 0,
            skipped: 0,
        };
    }
}
//# sourceMappingURL=news-collector.handler.js.map