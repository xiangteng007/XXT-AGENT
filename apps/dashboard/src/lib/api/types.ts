// TypeScript interfaces for all data types used in the dashboard

export interface Evidence {
    source: string;
    title: string;
    url?: string;
    ts: string;
}

export interface FusedEvent {
    id: string;
    ts: string;
    tenantId?: string;
    domain: 'market' | 'news' | 'social' | 'fusion';
    eventType?: string;
    news_title: string;
    severity: number;
    symbol?: string;
    sentiment?: 'bullish' | 'bearish' | 'neutral' | 'unknown';
    impact_summary?: string;
    impact_hypothesis?: string[];
    confidence?: number;
    evidence: Evidence[];
}

export interface SocialPost {
    id: string;
    platform: 'Facebook' | 'Instagram' | 'Threads' | 'LINE';
    author: string;
    authorHandle: string;
    content: string;
    timestamp: string;
    likes: number;
    comments: number;
    shares: number;
    engagement: number;
    sentiment?: 'bullish' | 'bearish' | 'neutral';
    severity?: number;
    keywords?: string[];
    url: string | null;
}

export interface NewsItem {
    id: string;
    source: string;
    title: string;
    summary: string;
    timestamp: string;
    topic: string;
    symbols: string[];
    sentiment?: 'bullish' | 'bearish' | 'neutral';
    severity?: number;
    url: string;
    impactHint?: string;
}

export interface MarketQuote {
    symbol: string;
    name: string;
    type: 'stock' | 'etf' | 'crypto' | 'future' | 'fx';
    lastPrice: number;
    previousClose: number;
    change: number;
    changePct: number;
    volume: number;
    high: number;
    low: number;
    eventCount: number;
    lastEventSeverity?: number;
    updatedAt: string;
}

export interface ServiceHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastHeartbeat: string;
    messagesProcessed: number;
    errorRate: number;
}

export interface SystemMetrics {
    updatedAt: string;
    pipeline: {
        ingestPerMin: number;
        fusedPerMin: number;
        notifySuccessRate: number;
        dlqCount: number;
    };
    services: {
        marketStreamer: ServiceHealth;
        newsCollector: ServiceHealth;
        socialDispatcher: ServiceHealth;
        socialWorker: ServiceHealth;
        fusionEngine: ServiceHealth;
        alertEngine: ServiceHealth;
    };
    alerts: {
        sentToday: number;
        telegramDelivered: number;
        lineDelivered: number;
        webhookDelivered: number;
    };
    storage: {
        firestoreDocuments: number;
        redisMemoryUsageMb: number;
        pubsubMessagesToday: number;
    };
    latency: {
        ingestToFusionMs: number;
        fusionToAlertMs: number;
        avgResponseTimeMs: number;
    };
}

export interface Keyword {
    id: string;
    keyword: string;
    priority: 'high' | 'medium' | 'low';
    createdAt: string;
}

export interface ExcludeWord {
    id: string;
    word: string;
    createdAt: string;
}

export interface NotificationChannel {
    type: 'telegram' | 'line' | 'webhook';
    target: string;
    enabled: boolean;
}

export interface NotificationRule {
    id: string;
    name: string;
    enabled: boolean;
    keywords: string[];
    minSeverity: number;
    channels: NotificationChannel[];
    createdAt: string;
}

// Filter types
export interface EventFilters {
    severity?: number;
    keyword?: string;
    domain?: 'market' | 'news' | 'social' | 'fusion' | 'all';
    symbol?: string;
    sortBy?: 'severity' | 'time';
    sortOrder?: 'asc' | 'desc';
}

export interface SocialFilters {
    platform?: 'Facebook' | 'Instagram' | 'Threads' | 'LINE' | 'all';
    keyword?: string;
    timeRange?: '30m' | '2h' | '24h' | '7d';
    minEngagement?: number;
}

export interface NewsFilters {
    topic?: string;
    keyword?: string;
    timeRange?: '30m' | '2h' | '24h' | '7d';
}
