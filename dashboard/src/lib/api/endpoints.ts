// API endpoints configuration

export const ENDPOINTS = {
    FUSED_EVENTS: '/api/events',
    SOCIAL_POSTS: '/api/social/posts',
    NEWS_ITEMS: '/api/news',
    MARKET_QUOTES: '/api/market/quotes',
    SYSTEM_METRICS: '/api/metrics',
    KEYWORDS: '/api/social/keywords',
    EXCLUDE_WORDS: '/api/social/exclude-words',
    NOTIFICATIONS: '/api/notifications',
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;
