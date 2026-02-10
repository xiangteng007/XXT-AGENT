/**
 * News Collector Handler
 * 
 * Scheduled function to collect news from RSS feeds
 * and store in Firestore for dashboard display.
 */

import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { fetchAllRssFeeds, deduplicateItems, RssItem } from '../services/rss.service';

const MARKET_NEWS_COLLECTION = 'market_news';
const RECENT_HOURS = 24; // Only keep URLs from last 24 hours for dedup

/**
 * Get recently seen URLs from Firestore (for deduplication)
 */
async function getRecentUrls(): Promise<Set<string>> {
    const db = getFirestore();
    const cutoff = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000);
    
    const snapshot = await db.collection(MARKET_NEWS_COLLECTION)
        .where('ts', '>', Timestamp.fromDate(cutoff))
        .select('url')
        .get();

    const urls = new Set<string>();
    snapshot.docs.forEach(doc => {
        const url = doc.data().url;
        if (url) urls.add(url);
    });

    logger.info(`Found ${urls.size} recent URLs for deduplication`);
    return urls;
}

/**
 * Write news items to Firestore
 */
async function writeNewsToFirestore(items: RssItem[]): Promise<number> {
    if (items.length === 0) return 0;

    const db = getFirestore();
    const batch = db.batch();
    const ts = Timestamp.now();
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
    logger.info(`Wrote ${count} news items to Firestore`);
    return count;
}

/**
 * Main handler for scheduled news collection
 */
export async function handleNewsCollector(): Promise<{
    ok: boolean;
    fetched: number;
    written: number;
    skipped: number;
}> {
    logger.info('[News Collector] Starting collection...');

    try {
        // 1. Fetch RSS feeds
        const allItems = await fetchAllRssFeeds();

        // 2. Get recent URLs for deduplication
        const recentUrls = await getRecentUrls();

        // 3. Deduplicate
        const newItems = deduplicateItems(allItems, recentUrls);

        // 4. Write to Firestore
        const written = await writeNewsToFirestore(newItems);

        const result = {
            ok: true,
            fetched: allItems.length,
            written: written,
            skipped: allItems.length - newItems.length,
        };

        logger.info('[News Collector] Complete:', result);
        return result;

    } catch (error) {
        logger.error('[News Collector] Error:', error);
        return {
            ok: false,
            fetched: 0,
            written: 0,
            skipped: 0,
        };
    }
}
