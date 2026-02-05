import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/social/trends
 * Get trending keywords/topics
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();
        const searchParams = req.nextUrl.searchParams;
        const range = searchParams.get('range') || '24h';

        // Calculate time range
        const now = new Date();
        let since: Date;
        switch (range) {
            case '1h': since = new Date(now.getTime() - 60 * 60 * 1000); break;
            case '7d': since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
            case '30d': since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
            default: since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        // Fetch posts in time range
        const snapshot = await db.collection('social_posts')
            .where('createdAt', '>=', since)
            .orderBy('createdAt', 'desc')
            .limit(1000)
            .get();

        // Aggregate keywords
        const keywordCounts: Record<string, {
            count: number;
            platforms: Set<string>;
            sentiments: string[];
            lastSeen: Date;
        }> = {};

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const keywords = data.keywords || [];
            const platform = data.platform;
            const sentiment = data.sentiment;
            const createdAt = data.createdAt?.toDate?.() || new Date();

            keywords.forEach((kw: string) => {
                if (!keywordCounts[kw]) {
                    keywordCounts[kw] = {
                        count: 0,
                        platforms: new Set(),
                        sentiments: [],
                        lastSeen: createdAt,
                    };
                }
                keywordCounts[kw].count++;
                keywordCounts[kw].platforms.add(platform);
                keywordCounts[kw].sentiments.push(sentiment);
                if (createdAt > keywordCounts[kw].lastSeen) {
                    keywordCounts[kw].lastSeen = createdAt;
                }
            });
        });

        // Convert to array and sort by count
        const trends = Object.entries(keywordCounts)
            .map(([keyword, data]) => {
                // Calculate dominant sentiment
                const sentimentCounts = data.sentiments.reduce((acc, s) => {
                    acc[s] = (acc[s] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                const maxSentiment = Object.entries(sentimentCounts)
                    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

                const hasMixed = Object.keys(sentimentCounts).length > 1;

                return {
                    keyword,
                    count: data.count,
                    change: Math.floor(Math.random() * 100 - 30), // TODO: Calculate real change
                    sentiment: hasMixed && data.sentiments.length > 5 ? 'mixed' : maxSentiment,
                    platforms: Array.from(data.platforms),
                    lastSeen: data.lastSeen.toISOString(),
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        return NextResponse.json({ trends });

    } catch (error) {
        console.error('Social trends API error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
