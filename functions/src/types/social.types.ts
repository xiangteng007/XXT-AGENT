/**
 * Social Intelligence Pipeline - Types and Interfaces
 * Per SPEC_PHASE6_5_PHASE7.md
 */

// ================================
// Source Configuration
// ================================

export interface SocialSource {
    id: string;
    tenantId: string;
    enabled: boolean;
    platform: 'facebook' | 'instagram' | 'twitter' | 'threads' | 'ptt' | 'line' | 'rss' | 'other';
    mode: 'webhook' | 'poll';
    credentialsRef: string; // Secret Manager reference
    config: SourceConfig;
    createdAt: Date;
    updatedAt: Date;
}

export interface SourceConfig {
    pageId?: string;
    hashtag?: string;
    keywordRules?: string[];
    regionRules?: string[];
    rateLimitBudget?: number;
    feedUrl?: string; // For RSS
    apiEndpoint?: string;
}

// ================================
// Cursor Management
// ================================

export interface SocialCursor {
    id: string; // {tenantId}_{sourceId}
    cursorType: 'sinceId' | 'sinceTs' | 'nextPageToken';
    cursorValue: string;
    lastSuccessAt: Date | null;
    lastErrorAt: Date | null;
    errorCount: number;
    updatedAt: Date;
}

// ================================
// Normalized Post
// ================================

export interface NormalizedPost {
    postKey: string; // {platform}:{sourceId}:{postId}
    tenantId: string;
    sourceId: string;
    platform: string;
    postId: string;
    title: string;
    summary: string;
    createdAt: Date;
    url: string;
    author: string;
    location?: string;
    engagement: Engagement;
    keywords: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
    urgency: number; // 1-10
    severity: number; // 0-100
    entities: Entity[];
    dedupHash: string; // SHA256(title + url + createdAtDate)
    rawRef: Record<string, any>;
    insertedAt: Date;
}

export interface Engagement {
    likes: number;
    comments: number;
    shares: number;
    views: number;
}

export interface Entity {
    type: 'ticker' | 'fund' | 'future' | 'topic' | 'location' | 'person' | 'org';
    value: string;
    confidence?: number;
}

// ================================
// Fused Event (Unified Event Bus)
// ================================

export interface FusedEvent {
    id: string;
    ts: Date;
    tenantId: string;
    domain: 'social' | 'market' | 'news' | 'fusion' | 'alert';
    eventType: string;
    title: string;
    severity: number; // 0-100
    direction: 'positive' | 'negative' | 'mixed' | 'neutral';
    sentiment: 'positive' | 'negative' | 'neutral';
    keywords: string[];
    entities: Entity[];
    location?: string;
    url?: string;
    engagement?: Engagement;
    market?: MarketData;
    rationale?: string;
    impactHint?: string;
    rawRef?: Record<string, any>;
}

export interface MarketData {
    symbol: string;
    assetClass: 'stock' | 'fund' | 'future' | 'fx' | 'crypto';
    price: number;
    changePct1m?: number;
    changePct5m?: number;
    changePct1h?: number;
    volumeSpike?: boolean;
}

// ================================
// Adapter Interface
// ================================

export interface SocialAdapter {
    platform: string;
    fetchDelta(cursor: SocialCursor, config: SourceConfig): Promise<FetchResult>;
    mapToNormalized(item: any, source: SocialSource): NormalizedPost;
}

export interface FetchResult {
    items: any[];
    nextCursor: Partial<SocialCursor>;
    rateLimit?: {
        remaining: number;
        resetAt: Date;
    };
}

// ================================
// Job Types
// ================================

export interface CollectJob {
    tenantId: string;
    sourceId: string;
    platform: string;
    priority: 'high' | 'normal' | 'low';
    retryCount: number;
    createdAt: Date;
}

// ================================
// Notification Settings
// ================================

export interface NotificationSetting {
    id: string;
    channel: 'telegram' | 'line' | 'webhook' | 'email' | 'slack';
    enabled: boolean;
    name: string;
    config: NotificationConfig;
    minSeverity: number;
    minUrgency: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotificationConfig {
    // Telegram
    botToken?: string;
    chatId?: string;
    // LINE
    accessToken?: string;
    // Webhook
    url?: string;
    headers?: Record<string, string>;
    // Email
    recipients?: string[];
    // Slack
    webhookUrl?: string;
    channel?: string;
}

// ================================
// Gemini Enrichment
// ================================

export interface GeminiEnrichRequest {
    type: 'social' | 'news' | 'fusion';
    content: string;
    context?: {
        platform?: string;
        location?: string;
        existingKeywords?: string[];
    };
}

export interface GeminiEnrichResponse {
    severity: number;
    sentiment: 'positive' | 'negative' | 'neutral';
    keywords: string[];
    entities: Entity[];
    impactHint: string;
    rationale: string;
}
