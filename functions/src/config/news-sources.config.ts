/**
 * Predefined News Sources Configuration
 * 
 * Contains RSS feed URLs for major international news sources.
 * Used by the butler system for news monitoring and analysis.
 */

export interface NewsSource {
    id: string;
    name: string;
    platform: 'rss';
    feedUrl: string;
    category: 'world' | 'business' | 'tech' | 'health' | 'sports' | 'entertainment';
    language: string;
    region: string;
    enabled: boolean;
}

/**
 * International News Sources
 */
export const INTERNATIONAL_NEWS_SOURCES: NewsSource[] = [
    // CNN
    {
        id: 'cnn-world',
        name: 'CNN World News',
        platform: 'rss',
        feedUrl: 'http://rss.cnn.com/rss/edition_world.rss',
        category: 'world',
        language: 'en',
        region: 'US',
        enabled: true,
    },
    {
        id: 'cnn-business',
        name: 'CNN Business',
        platform: 'rss',
        feedUrl: 'http://rss.cnn.com/rss/money_news_international.rss',
        category: 'business',
        language: 'en',
        region: 'US',
        enabled: true,
    },
    {
        id: 'cnn-tech',
        name: 'CNN Tech',
        platform: 'rss',
        feedUrl: 'http://rss.cnn.com/rss/edition_technology.rss',
        category: 'tech',
        language: 'en',
        region: 'US',
        enabled: true,
    },
    {
        id: 'cnn-health',
        name: 'CNN Health',
        platform: 'rss',
        feedUrl: 'http://rss.cnn.com/rss/edition_health.rss',
        category: 'health',
        language: 'en',
        region: 'US',
        enabled: true,
    },

    // BBC
    {
        id: 'bbc-world',
        name: 'BBC World News',
        platform: 'rss',
        feedUrl: 'http://feeds.bbci.co.uk/news/world/rss.xml',
        category: 'world',
        language: 'en',
        region: 'UK',
        enabled: true,
    },
    {
        id: 'bbc-business',
        name: 'BBC Business',
        platform: 'rss',
        feedUrl: 'http://feeds.bbci.co.uk/news/business/rss.xml',
        category: 'business',
        language: 'en',
        region: 'UK',
        enabled: true,
    },
    {
        id: 'bbc-tech',
        name: 'BBC Technology',
        platform: 'rss',
        feedUrl: 'http://feeds.bbci.co.uk/news/technology/rss.xml',
        category: 'tech',
        language: 'en',
        region: 'UK',
        enabled: true,
    },
    {
        id: 'bbc-health',
        name: 'BBC Health',
        platform: 'rss',
        feedUrl: 'http://feeds.bbci.co.uk/news/health/rss.xml',
        category: 'health',
        language: 'en',
        region: 'UK',
        enabled: true,
    },
    {
        id: 'bbc-asia',
        name: 'BBC Asia',
        platform: 'rss',
        feedUrl: 'http://feeds.bbci.co.uk/news/world/asia/rss.xml',
        category: 'world',
        language: 'en',
        region: 'Asia',
        enabled: true,
    },
];

/**
 * Taiwan & Asia News Sources
 */
export const TAIWAN_NEWS_SOURCES: NewsSource[] = [
    {
        id: 'cna-general',
        name: '中央社 CNA',
        platform: 'rss',
        feedUrl: 'https://www.cna.com.tw/RSS/aall.xml',
        category: 'world',
        language: 'zh-TW',
        region: 'TW',
        enabled: true,
    },
    {
        id: 'udn-news',
        name: '聯合新聞網',
        platform: 'rss',
        feedUrl: 'https://udn.com/rssfeed/news/1/1',
        category: 'world',
        language: 'zh-TW',
        region: 'TW',
        enabled: true,
    },
    {
        id: 'ltn-news',
        name: '自由時報',
        platform: 'rss',
        feedUrl: 'https://news.ltn.com.tw/rss/all.xml',
        category: 'world',
        language: 'zh-TW',
        region: 'TW',
        enabled: true,
    },
];

/**
 * Finance & Investment News
 */
export const FINANCE_NEWS_SOURCES: NewsSource[] = [
    {
        id: 'reuters-business',
        name: 'Reuters Business',
        platform: 'rss',
        feedUrl: 'https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best',
        category: 'business',
        language: 'en',
        region: 'Global',
        enabled: true,
    },
    {
        id: 'cnbc-world',
        name: 'CNBC World',
        platform: 'rss',
        feedUrl: 'https://www.cnbc.com/id/100727362/device/rss/rss.html',
        category: 'business',
        language: 'en',
        region: 'US',
        enabled: true,
    },
    {
        id: 'ft-world',
        name: 'Financial Times World',
        platform: 'rss',
        feedUrl: 'https://www.ft.com/world?format=rss',
        category: 'world',
        language: 'en',
        region: 'UK',
        enabled: true,
    },
];

/**
 * Tech News Sources
 */
export const TECH_NEWS_SOURCES: NewsSource[] = [
    {
        id: 'techcrunch',
        name: 'TechCrunch',
        platform: 'rss',
        feedUrl: 'https://techcrunch.com/feed/',
        category: 'tech',
        language: 'en',
        region: 'US',
        enabled: true,
    },
    {
        id: 'wired',
        name: 'Wired',
        platform: 'rss',
        feedUrl: 'https://www.wired.com/feed/rss',
        category: 'tech',
        language: 'en',
        region: 'US',
        enabled: true,
    },
    {
        id: 'theverge',
        name: 'The Verge',
        platform: 'rss',
        feedUrl: 'https://www.theverge.com/rss/index.xml',
        category: 'tech',
        language: 'en',
        region: 'US',
        enabled: true,
    },
];

/**
 * All news sources combined
 */
export const ALL_NEWS_SOURCES: NewsSource[] = [
    ...INTERNATIONAL_NEWS_SOURCES,
    ...TAIWAN_NEWS_SOURCES,
    ...FINANCE_NEWS_SOURCES,
    ...TECH_NEWS_SOURCES,
];

/**
 * Get enabled news sources by category
 */
export function getSourcesByCategory(category: NewsSource['category']): NewsSource[] {
    return ALL_NEWS_SOURCES.filter(s => s.enabled && s.category === category);
}

/**
 * Get enabled news sources by region
 */
export function getSourcesByRegion(region: string): NewsSource[] {
    return ALL_NEWS_SOURCES.filter(s => s.enabled && s.region === region);
}

/**
 * Get all enabled news sources
 */
export function getEnabledSources(): NewsSource[] {
    return ALL_NEWS_SOURCES.filter(s => s.enabled);
}
