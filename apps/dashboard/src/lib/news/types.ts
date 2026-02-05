// Comprehensive news monitoring types

// ============ Core Types ============

export type NewsSource =
    | 'reuters'
    | 'bloomberg'
    | 'wsj'
    | 'cnbc'
    | 'yahoo'
    | 'google'
    | 'local'
    | 'other';

export type NewsTopic =
    | 'earnings'
    | 'merger'
    | 'regulation'
    | 'macro'
    | 'tech'
    | 'crypto'
    | 'commodity'
    | 'forex'
    | 'politics'
    | 'other';

export type NewsSentiment = 'bullish' | 'bearish' | 'neutral' | 'mixed';

export type NewsImpact = 'high' | 'medium' | 'low' | 'none';

// ============ News Article ============

export interface NewsArticle {
    id: string;

    // Content
    title: string;
    summary: string;
    content?: string;
    url: string;
    imageUrl?: string;

    // Metadata
    source: NewsSource;
    sourceName: string;
    author?: string;
    publishedAt: string;
    collectedAt: string;
    language: string;

    // Classification
    topics: NewsTopic[];
    symbols: string[];
    keywords: string[];

    // Analysis
    sentiment?: NewsAnalysis;
    impact?: NewsImpactAnalysis;
    severity?: number;

    // Tracking
    views?: number;
    isBookmarked?: boolean;
    isRead?: boolean;
}

// ============ AI Analysis ============

export interface NewsAnalysis {
    sentiment: NewsSentiment;
    sentimentScore: number;  // -1 to 1
    confidence: number;

    // Key points
    keyPoints: string[];
    entities: {
        name: string;
        type: 'company' | 'person' | 'product' | 'country' | 'event';
    }[];

    // AI summary
    aiSummary?: string;

    model: string;
    analyzedAt: string;
}

export interface NewsImpactAnalysis {
    level: NewsImpact;
    score: number;  // 0 to 100

    // Affected assets
    affectedSymbols: {
        symbol: string;
        direction: 'positive' | 'negative' | 'neutral';
        magnitude: number;
    }[];

    // Timing
    timeframe: 'immediate' | 'short_term' | 'long_term';

    // Reasoning
    reasoning: string;
}

// ============ News Source ============

export interface NewsSourceConfig {
    id: string;
    name: string;
    source: NewsSource;
    url: string;

    // Trust metrics
    reliability: number;  // 0 to 100
    bias?: 'left' | 'center' | 'right' | 'unknown';

    // Settings
    enabled: boolean;
    priority: 'high' | 'medium' | 'low';
    refreshInterval: number;  // seconds

    // Stats
    articleCount: number;
    lastFetchedAt?: string;
}

// ============ News Alert ============

export interface NewsAlert {
    id: string;
    name: string;
    enabled: boolean;

    // Conditions
    keywords: string[];
    symbols: string[];
    topics: NewsTopic[];
    sources?: NewsSource[];
    minImpact?: NewsImpact;
    minSeverity?: number;

    // Notifications
    channels: {
        type: 'telegram' | 'line' | 'email' | 'push';
        enabled: boolean;
    }[];

    // Rate limiting
    cooldownMinutes: number;

    // Stats
    triggerCount: number;
    lastTriggeredAt?: string;
    createdAt: string;
}

// ============ Dashboard Summary ============

export interface NewsDashboardSummary {
    // Today's stats
    todayArticles: number;
    todayHighImpact: number;
    articlesTrend: number;

    // Sentiment
    overallSentiment: NewsSentiment;
    sentimentScore: number;

    // Top items
    topStories: NewsArticle[];
    trendingSymbols: { symbol: string; count: number; sentiment: NewsSentiment }[];
    trendingTopics: { topic: NewsTopic; count: number }[];

    // Active monitoring
    activeSources: number;
    activeAlerts: number;
}

// ============ Analytics ============

export interface NewsAnalytics {
    period: { start: string; end: string };

    totalArticles: number;
    articlesPerDay: { date: string; count: number }[];
    articlesPerSource: { source: NewsSource; count: number }[];
    articlesPerTopic: { topic: NewsTopic; count: number }[];

    sentimentTrend: { date: string; score: number }[];
    impactDistribution: { level: NewsImpact; count: number }[];

    topSymbols: { symbol: string; count: number; avgSentiment: number }[];
}
