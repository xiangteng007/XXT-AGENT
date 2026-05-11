/**
 * GET /api/social/posts - List social posts
 * Falls back to RSS feed aggregation when no backend data exists
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        // Fallback: fetch from internal RSS aggregator
        try {
            const origin = req.nextUrl.origin;
            const rssRes = await fetch(`${origin}/api/social/feed`);
            if (rssRes.ok) {
                const rssData = await rssRes.json();
                const posts = (rssData.posts || []).map((p: Record<string, unknown>) => ({
                    id: p.id,
                    platform: 'twitter' as const, // Map Reddit to generic
                    postType: 'text' as const,
                    author: {
                        id: `author-${p.id}`,
                        username: (p.author as string) || 'anonymous',
                        displayName: (p.author as string) || 'Anonymous',
                        isVerified: false,
                        platform: 'twitter' as const,
                    },
                    content: p.content,
                    hashtags: (p.keywords as string[]) || [],
                    mentions: [],
                    engagement: {
                        likes: (p.engagement as Record<string, number>)?.likes || 0,
                        comments: (p.engagement as Record<string, number>)?.comments || 0,
                        shares: (p.engagement as Record<string, number>)?.shares || 0,
                        total: ((p.engagement as Record<string, number>)?.likes || 0) +
                               ((p.engagement as Record<string, number>)?.comments || 0) +
                               ((p.engagement as Record<string, number>)?.shares || 0),
                    },
                    sentiment: {
                        score: p.sentiment === 'positive' ? 0.7 : p.sentiment === 'negative' ? -0.5 : 0.1,
                        label: p.sentiment || 'neutral',
                        confidence: 0.6,
                        entities: [],
                        topics: (p.keywords as string[]) || [],
                        model: 'keyword-heuristic',
                        analyzedAt: new Date().toISOString(),
                    },
                    matchedKeywords: (p.keywords as string[]) || [],
                    severity: 30,
                    publishedAt: p.publishedAt,
                    collectedAt: new Date().toISOString(),
                    sourceUrl: p.url || '',
                }));

                return NextResponse.json({
                    posts,
                    total: posts.length,
                    source: 'rss-aggregation',
                });
            }
        } catch {
            // RSS failed
        }

        return NextResponse.json({ posts: [], total: 0 });
    } catch (error) {
        console.error('Social posts GET error:', error);
        return NextResponse.json(
            { error: 'Internal error', posts: [], total: 0 },
            { status: 500 }
        );
    }
}
