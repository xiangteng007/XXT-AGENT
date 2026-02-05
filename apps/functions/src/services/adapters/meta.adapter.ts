/**
 * Meta Platform Adapter
 * 
 * Handles Facebook, Instagram, and Threads API integration.
 * Requires Meta Developer App credentials.
 */

import {
    SocialAdapter,
    SocialSource,
    SocialCursor,
    SourceConfig,
    FetchResult,
    NormalizedPost,
} from '../../types/social.types';
import { generateDedupHash } from '../social-collector.service';

// ================================
// Meta Graph API Types
// ================================

interface MetaPost {
    id: string;
    message?: string;
    story?: string;
    created_time: string;
    permalink_url?: string;
    from?: { id: string; name: string };
    likes?: { summary: { total_count: number } };
    comments?: { summary: { total_count: number } };
    shares?: { count: number };
    [key: string]: unknown;
}

interface InstagramMedia {
    id: string;
    caption?: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    media_url: string;
    permalink: string;
    timestamp: string;
    username: string;
    like_count?: number;
    comments_count?: number;
    [key: string]: unknown;
}

interface ThreadsPost {
    id: string;
    text?: string;
    created_time: string;
    permalink?: string;
    username: string;
    like_count?: number;
    reply_count?: number;
    repost_count?: number;
    [key: string]: unknown;
}

// ================================
// Facebook Adapter
// ================================

export function createFacebookAdapter(): SocialAdapter {
    return {
        platform: 'facebook',

        async fetchDelta(cursor: SocialCursor, config: SourceConfig): Promise<FetchResult> {
            if (!config.pageId) {
                throw new Error('Facebook adapter requires pageId in config');
            }

            const accessToken = process.env.META_ACCESS_TOKEN;
            if (!accessToken) {
                throw new Error('META_ACCESS_TOKEN environment variable not set');
            }

            const sinceTs = cursor.cursorValue
                ? Math.floor(new Date(cursor.cursorValue).getTime() / 1000)
                : Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

            const fields = 'id,message,story,created_time,permalink_url,from,likes.summary(true),comments.summary(true),shares';
            const url = `https://graph.facebook.com/v18.0/${config.pageId}/posts?fields=${fields}&since=${sinceTs}&access_token=${accessToken}`;

            const response = await fetch(url);
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Facebook API error: ${response.status} - ${error}`);
            }

            const data = await response.json() as { data: MetaPost[] };
            const items = data.data || [];

            const latestTs = items.length > 0
                ? new Date(items[0].created_time)
                : new Date();

            return {
                items: items as unknown as Record<string, unknown>[],
                nextCursor: {
                    cursorType: 'sinceTs',
                    cursorValue: latestTs.toISOString(),
                },
            };
        },

        mapToNormalized(item: Record<string, unknown>, source: SocialSource): NormalizedPost {
            const post = item as unknown as MetaPost;
            const postId = post.id;
            const createdAt = new Date(post.created_time);
            const content = post.message || post.story || '';

            return {
                postKey: `facebook:${source.id}:${postId}`,
                tenantId: source.tenantId,
                sourceId: source.id,
                platform: 'facebook',
                postId,
                title: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
                summary: content.slice(0, 500),
                createdAt,
                url: post.permalink_url || `https://facebook.com/${postId}`,
                author: post.from?.name || 'Unknown',
                engagement: {
                    likes: post.likes?.summary?.total_count || 0,
                    comments: post.comments?.summary?.total_count || 0,
                    shares: post.shares?.count || 0,
                    views: 0,
                },
                keywords: extractHashtags(content),
                sentiment: 'neutral',
                urgency: 1,
                severity: 10,
                entities: [],
                dedupHash: generateDedupHash(content, post.permalink_url || '', createdAt),
                rawRef: item,
                insertedAt: new Date(),
            };
        },
    };
}

// ================================
// Instagram Adapter
// ================================

export function createInstagramAdapter(): SocialAdapter {
    return {
        platform: 'instagram',

        async fetchDelta(cursor: SocialCursor, config: SourceConfig): Promise<FetchResult> {
            const accessToken = process.env.META_ACCESS_TOKEN;
            if (!accessToken) {
                throw new Error('META_ACCESS_TOKEN environment variable not set');
            }

            const accountId = config.pageId;
            if (!accountId) {
                throw new Error('Instagram adapter requires pageId (IG Business Account ID) in config');
            }

            const fields = 'id,caption,media_type,media_url,permalink,timestamp,username,like_count,comments_count';
            const url = `https://graph.facebook.com/v18.0/${accountId}/media?fields=${fields}&access_token=${accessToken}`;

            const response = await fetch(url);
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Instagram API error: ${response.status} - ${error}`);
            }

            const data = await response.json() as { data: InstagramMedia[] };
            const items = data.data || [];

            const sinceDate = cursor.cursorValue
                ? new Date(cursor.cursorValue)
                : new Date(Date.now() - 24 * 60 * 60 * 1000);

            const newItems = items.filter(item => new Date(item.timestamp) > sinceDate);

            const latestTs = newItems.length > 0
                ? new Date(newItems[0].timestamp)
                : new Date();

            return {
                items: newItems as unknown as Record<string, unknown>[],
                nextCursor: {
                    cursorType: 'sinceTs',
                    cursorValue: latestTs.toISOString(),
                },
            };
        },

        mapToNormalized(item: Record<string, unknown>, source: SocialSource): NormalizedPost {
            const media = item as unknown as InstagramMedia;
            const postId = media.id;
            const createdAt = new Date(media.timestamp);
            const content = media.caption || '';

            return {
                postKey: `instagram:${source.id}:${postId}`,
                tenantId: source.tenantId,
                sourceId: source.id,
                platform: 'instagram',
                postId,
                title: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
                summary: content.slice(0, 500),
                createdAt,
                url: media.permalink,
                author: media.username,
                engagement: {
                    likes: media.like_count || 0,
                    comments: media.comments_count || 0,
                    shares: 0,
                    views: 0,
                },
                keywords: extractHashtags(content),
                sentiment: 'neutral',
                urgency: 1,
                severity: 10,
                entities: [],
                dedupHash: generateDedupHash(content, media.permalink, createdAt),
                rawRef: item,
                insertedAt: new Date(),
            };
        },
    };
}

// ================================
// Threads Adapter
// ================================

export function createThreadsAdapter(): SocialAdapter {
    return {
        platform: 'threads',

        async fetchDelta(cursor: SocialCursor, config: SourceConfig): Promise<FetchResult> {
            const accessToken = process.env.THREADS_ACCESS_TOKEN;
            if (!accessToken) {
                throw new Error('THREADS_ACCESS_TOKEN environment variable not set');
            }

            const userId = config.pageId;
            if (!userId) {
                throw new Error('Threads adapter requires pageId (Threads User ID) in config');
            }

            const fields = 'id,text,created_time,permalink,username,like_count,reply_count,repost_count';
            const url = `https://graph.threads.net/v1.0/${userId}/threads?fields=${fields}&access_token=${accessToken}`;

            const response = await fetch(url);
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Threads API error: ${response.status} - ${error}`);
            }

            const data = await response.json() as { data: ThreadsPost[] };
            const items = data.data || [];

            const sinceDate = cursor.cursorValue
                ? new Date(cursor.cursorValue)
                : new Date(Date.now() - 24 * 60 * 60 * 1000);

            const newItems = items.filter(item => new Date(item.created_time) > sinceDate);

            const latestTs = newItems.length > 0
                ? new Date(newItems[0].created_time)
                : new Date();

            return {
                items: newItems as unknown as Record<string, unknown>[],
                nextCursor: {
                    cursorType: 'sinceTs',
                    cursorValue: latestTs.toISOString(),
                },
            };
        },

        mapToNormalized(item: Record<string, unknown>, source: SocialSource): NormalizedPost {
            const post = item as unknown as ThreadsPost;
            const postId = post.id;
            const createdAt = new Date(post.created_time);
            const content = post.text || '';

            return {
                postKey: `threads:${source.id}:${postId}`,
                tenantId: source.tenantId,
                sourceId: source.id,
                platform: 'threads',
                postId,
                title: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
                summary: content.slice(0, 500),
                createdAt,
                url: post.permalink || `https://threads.net/@${post.username}/post/${postId}`,
                author: post.username,
                engagement: {
                    likes: post.like_count || 0,
                    comments: post.reply_count || 0,
                    shares: post.repost_count || 0,
                    views: 0,
                },
                keywords: extractHashtags(content),
                sentiment: 'neutral',
                urgency: 1,
                severity: 10,
                entities: [],
                dedupHash: generateDedupHash(content, post.permalink || '', createdAt),
                rawRef: item,
                insertedAt: new Date(),
            };
        },
    };
}

// ================================
// Helper Functions
// ================================

function extractHashtags(text: string): string[] {
    const hashtags = text.match(/#[\w\u4e00-\u9fff]+/g) || [];
    return hashtags.map(h => h.slice(1)).slice(0, 10);
}
