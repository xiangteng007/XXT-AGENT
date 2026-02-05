/**
 * Social Intelligence Pipeline - Types and Interfaces
 * Per SPEC_PHASE6_5_PHASE7.md
 */
export interface SocialSource {
    id: string;
    tenantId: string;
    enabled: boolean;
    platform: 'facebook' | 'instagram' | 'twitter' | 'threads' | 'ptt' | 'line' | 'rss' | 'other';
    mode: 'webhook' | 'poll';
    credentialsRef: string;
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
    feedUrl?: string;
    apiEndpoint?: string;
}
export interface SocialCursor {
    id: string;
    cursorType: 'sinceId' | 'sinceTs' | 'nextPageToken';
    cursorValue: string;
    lastSuccessAt: Date | null;
    lastErrorAt: Date | null;
    errorCount: number;
    updatedAt: Date;
}
export interface NormalizedPost {
    postKey: string;
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
    urgency: number;
    severity: number;
    entities: Entity[];
    dedupHash: string;
    rawRef: Record<string, unknown>;
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
export interface FusedEvent {
    id: string;
    ts: Date;
    tenantId: string;
    domain: 'social' | 'market' | 'news' | 'fusion' | 'alert';
    eventType: string;
    title: string;
    severity: number;
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
    rawRef?: Record<string, unknown>;
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
export interface RawSocialItem {
    id?: string;
    postId?: string;
    title?: string;
    text?: string;
    content?: string;
    url?: string;
    author?: string;
    createdAt?: string | Date;
    engagement?: Partial<Engagement>;
    [key: string]: unknown;
}
export interface SocialAdapter {
    platform: string;
    fetchDelta(cursor: SocialCursor, config: SourceConfig): Promise<FetchResult>;
    mapToNormalized(item: RawSocialItem | Record<string, unknown>, source: SocialSource): NormalizedPost;
}
export interface FetchResult {
    items: Array<RawSocialItem | Record<string, unknown>>;
    nextCursor: Partial<SocialCursor>;
    rateLimit?: {
        remaining: number;
        resetAt: Date;
    };
}
export interface CollectJob {
    tenantId: string;
    sourceId: string;
    platform: string;
    priority: 'high' | 'normal' | 'low';
    retryCount: number;
    createdAt: Date;
}
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
    botToken?: string;
    chatId?: string;
    accessToken?: string;
    url?: string;
    headers?: Record<string, string>;
    recipients?: string[];
    webhookUrl?: string;
    channel?: string;
}
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
//# sourceMappingURL=social.types.d.ts.map