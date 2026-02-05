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
export declare const INTERNATIONAL_NEWS_SOURCES: NewsSource[];
/**
 * Taiwan & Asia News Sources
 */
export declare const TAIWAN_NEWS_SOURCES: NewsSource[];
/**
 * Finance & Investment News
 */
export declare const FINANCE_NEWS_SOURCES: NewsSource[];
/**
 * Tech News Sources
 */
export declare const TECH_NEWS_SOURCES: NewsSource[];
/**
 * All news sources combined
 */
export declare const ALL_NEWS_SOURCES: NewsSource[];
/**
 * Get enabled news sources by category
 */
export declare function getSourcesByCategory(category: NewsSource['category']): NewsSource[];
/**
 * Get enabled news sources by region
 */
export declare function getSourcesByRegion(region: string): NewsSource[];
/**
 * Get all enabled news sources
 */
export declare function getEnabledSources(): NewsSource[];
//# sourceMappingURL=news-sources.config.d.ts.map