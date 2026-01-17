// API endpoints configuration

export const ENDPOINTS = {
    // Public data endpoints
    FUSED_EVENTS: '/api/events',
    SOCIAL_POSTS: '/api/social/posts',
    NEWS_ITEMS: '/api/news',
    MARKET_QUOTES: '/api/market/quotes',
    SYSTEM_METRICS: '/api/metrics',
    KEYWORDS: '/api/social/keywords',
    EXCLUDE_WORDS: '/api/social/exclude-words',
    NOTIFICATIONS: '/api/notifications',

    // Admin endpoints
    ADMIN_TENANTS: '/api/admin/tenants',
    ADMIN_JOBS: '/api/admin/jobs',
    ADMIN_RULES: '/api/admin/rules',
    ADMIN_MAPPINGS: '/api/admin/mappings',
    ADMIN_LOGS: '/api/admin/logs',
    ADMIN_STATS: '/api/admin/stats',
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;
