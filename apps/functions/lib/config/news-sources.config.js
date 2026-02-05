"use strict";
/**
 * Predefined News Sources Configuration
 *
 * Contains RSS feed URLs for major international news sources.
 * Used by the butler system for news monitoring and analysis.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_NEWS_SOURCES = exports.TECH_NEWS_SOURCES = exports.FINANCE_NEWS_SOURCES = exports.TAIWAN_NEWS_SOURCES = exports.INTERNATIONAL_NEWS_SOURCES = void 0;
exports.getSourcesByCategory = getSourcesByCategory;
exports.getSourcesByRegion = getSourcesByRegion;
exports.getEnabledSources = getEnabledSources;
/**
 * International News Sources
 */
exports.INTERNATIONAL_NEWS_SOURCES = [
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
exports.TAIWAN_NEWS_SOURCES = [
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
exports.FINANCE_NEWS_SOURCES = [
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
exports.TECH_NEWS_SOURCES = [
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
exports.ALL_NEWS_SOURCES = [
    ...exports.INTERNATIONAL_NEWS_SOURCES,
    ...exports.TAIWAN_NEWS_SOURCES,
    ...exports.FINANCE_NEWS_SOURCES,
    ...exports.TECH_NEWS_SOURCES,
];
/**
 * Get enabled news sources by category
 */
function getSourcesByCategory(category) {
    return exports.ALL_NEWS_SOURCES.filter(s => s.enabled && s.category === category);
}
/**
 * Get enabled news sources by region
 */
function getSourcesByRegion(region) {
    return exports.ALL_NEWS_SOURCES.filter(s => s.enabled && s.region === region);
}
/**
 * Get all enabled news sources
 */
function getEnabledSources() {
    return exports.ALL_NEWS_SOURCES.filter(s => s.enabled);
}
//# sourceMappingURL=news-sources.config.js.map