// Social monitoring comprehensive types

// ============ Core Types ============

export type SocialPlatform =
    | 'facebook'
    | 'instagram'
    | 'threads'
    | 'line'
    | 'twitter'
    | 'tiktok'
    | 'youtube';

export type SentimentLabel = 'positive' | 'negative' | 'neutral' | 'mixed';

export type PostType = 'text' | 'image' | 'video' | 'link' | 'story' | 'reel';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

// ============ Social Post ============

export interface SocialPost {
    id: string;
    platform: SocialPlatform;
    postType: PostType;

    // Author
    author: AuthorInfo;

    // Content
    content: string;
    mediaUrls?: string[];
    externalUrl?: string;
    hashtags: string[];
    mentions: string[];

    // Engagement
    engagement: EngagementMetrics;

    // Analysis
    sentiment?: SentimentAnalysis;
    matchedKeywords: string[];
    severity?: number;
    priority?: Priority;

    // Metadata
    publishedAt: string;
    collectedAt: string;
    sourceUrl: string;
    language?: string;
}

export interface AuthorInfo {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    isVerified: boolean;
    followerCount?: number;
    platform: SocialPlatform;
}

export interface EngagementMetrics {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
    saves?: number;
    total: number;  // Calculated sum
    engagementRate?: number;  // total / followerCount
}

// ============ Sentiment Analysis ============

export interface SentimentAnalysis {
    score: number;           // -1.0 to 1.0
    label: SentimentLabel;
    confidence: number;      // 0 to 1

    // Entity extraction
    entities: ExtractedEntity[];
    topics: string[];

    // Detailed scores
    emotionBreakdown?: {
        joy: number;
        anger: number;
        fear: number;
        sadness: number;
        surprise: number;
    };

    // AI metadata
    model: string;
    analyzedAt: string;
}

export interface ExtractedEntity {
    text: string;
    type: 'person' | 'organization' | 'product' | 'location' | 'event' | 'hashtag';
    sentiment?: SentimentLabel;
}

// ============ Tracked Account ============

export interface TrackedAccount {
    id: string;
    platform: SocialPlatform;
    username: string;
    displayName: string;
    avatarUrl?: string;

    // Classification
    accountType: 'kol' | 'competitor' | 'partner' | 'media' | 'influencer' | 'other';
    tags: string[];
    priority: Priority;

    // Stats
    followerCount: number;
    followingCount: number;
    postCount: number;
    avgEngagement: number;

    // Tracking
    isActive: boolean;
    lastPostAt?: string;
    lastCheckedAt: string;
    createdAt: string;
    notes?: string;
}

// ============ Keywords & Filters ============

export interface MonitorKeyword {
    id: string;
    keyword: string;
    isRegex: boolean;
    matchMode: 'exact' | 'contains' | 'startsWith' | 'regex';
    priority: Priority;
    platforms: SocialPlatform[] | 'all';
    category?: string;
    enabled: boolean;
    createdAt: string;
    hitCount: number;
}

export interface ExcludeRule {
    id: string;
    pattern: string;
    isRegex: boolean;
    reason?: string;
    enabled: boolean;
    createdAt: string;
}

// ============ Notification Rules ============

export interface NotificationChannel {
    type: 'telegram' | 'line' | 'email' | 'webhook' | 'push';
    enabled: boolean;
    config: Record<string, string>;
}

export interface AlertRule {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;

    // Trigger conditions
    conditions: {
        keywords?: string[];
        minSeverity?: number;
        platforms?: SocialPlatform[];
        minEngagement?: number;
        sentimentLabels?: SentimentLabel[];
        accountTypes?: TrackedAccount['accountType'][];
    };

    // Actions
    channels: NotificationChannel[];

    // Rate limiting
    cooldownMinutes: number;
    maxAlertsPerHour?: number;

    // Metadata
    createdAt: string;
    lastTriggeredAt?: string;
    triggerCount: number;
}

// ============ Analytics ============

export interface SocialAnalytics {
    period: {
        start: string;
        end: string;
    };

    // Volume
    totalPosts: number;
    postsPerPlatform: Record<SocialPlatform, number>;
    postsPerHour: { hour: number; count: number }[];
    postsPerDay: { date: string; count: number }[];

    // Engagement
    totalEngagement: number;
    avgEngagementPerPost: number;
    topEngagedPosts: SocialPost[];

    // Sentiment
    sentimentDistribution: Record<SentimentLabel, number>;
    sentimentTrend: { date: string; avgScore: number }[];

    // Keywords
    topKeywords: { keyword: string; count: number; trend: 'up' | 'down' | 'stable' }[];
    topHashtags: { hashtag: string; count: number }[];
    topMentions: { mention: string; count: number }[];

    // Authors
    topAuthors: { author: AuthorInfo; postCount: number; totalEngagement: number }[];
}

// ============ Real-time Stream ============

export interface StreamConfig {
    platforms: SocialPlatform[];
    keywords: string[];
    accounts: string[];
    minEngagement?: number;
    languages?: string[];
}

export interface StreamEvent {
    type: 'new_post' | 'engagement_update' | 'account_update' | 'alert';
    timestamp: string;
    data: SocialPost | EngagementMetrics | TrackedAccount | AlertRule;
}

// ============ Dashboard Summary ============

export interface SocialDashboardSummary {
    // Today's stats
    todayPosts: number;
    todayEngagement: number;
    todayAlerts: number;

    // Trends (vs yesterday)
    postsTrend: number;      // percentage change
    engagementTrend: number;

    // Current sentiment
    overallSentiment: SentimentLabel;
    sentimentScore: number;

    // Active monitoring
    activeKeywords: number;
    trackedAccounts: number;
    activeAlertRules: number;

    // Recent activity
    recentPosts: SocialPost[];
    recentAlerts: AlertRule[];
}
