/**
 * Seed Financial News RSS Feeds
 * 
 * Run with: npx ts-node scripts/seed-rss-feeds.ts
 * Seeds Firestore `social_sources` with Taiwan & global financial news RSS feeds.
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

const TENANT_ID = 'butler-default';

const RSS_FEEDS = [
    {
        name: '鉅亨網 台股新聞',
        platform: 'rss',
        url: 'https://news.cnyes.com/news/cat/tw_stock/rss',
        category: 'tw_stock',
        keywords: ['台股', '上市', '加權指數'],
        enabled: true,
    },
    {
        name: '鉅亨網 美股新聞',
        platform: 'rss',
        url: 'https://news.cnyes.com/news/cat/us_stock/rss',
        category: 'us_stock',
        keywords: ['美股', 'S&P500', 'NASDAQ'],
        enabled: true,
    },
    {
        name: '鉅亨網 國際總經',
        platform: 'rss',
        url: 'https://news.cnyes.com/news/cat/wd_macro/rss',
        category: 'macro',
        keywords: ['Fed', '央行', '利率', 'GDP'],
        enabled: true,
    },
    {
        name: 'Yahoo 股市 台灣',
        platform: 'rss',
        url: 'https://tw.stock.yahoo.com/rss?category=tw-market',
        category: 'tw_stock',
        keywords: ['台股', '外資', '投信'],
        enabled: true,
    },
    {
        name: 'MoneyDJ 理財新聞',
        platform: 'rss',
        url: 'https://www.moneydj.com/KMDJ/RSS/RSS.aspx?svc=NR&fType=1',
        category: 'finance',
        keywords: ['理財', '基金', 'ETF'],
        enabled: true,
    },
    {
        name: 'Reuters Business',
        platform: 'rss',
        url: 'https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best',
        category: 'global',
        keywords: ['Reuters', 'earnings', 'market'],
        enabled: true,
    },
];

async function seedFeeds(): Promise<void> {
    console.log(`Seeding ${RSS_FEEDS.length} RSS feeds for tenant: ${TENANT_ID}`);

    const batch = db.batch();

    for (const feed of RSS_FEEDS) {
        const docRef = db.collection('social_sources')
            .doc(TENANT_ID)
            .collection('sources')
            .doc(); // auto-ID

        batch.set(docRef, {
            ...feed,
            config: {
                feedUrl: feed.url,
                maxItems: 20,
                pollIntervalMinutes: 10,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`  + ${feed.name} (${feed.category})`);
    }

    await batch.commit();
    console.log('✅ All feeds seeded successfully.');
}

seedFeeds().catch(console.error);
