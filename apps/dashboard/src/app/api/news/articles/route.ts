import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/news/articles
 * List recent news articles from market_news collection
 * Falls back to RSS aggregation if Firestore is empty
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        // Parse query parameters
        const { searchParams } = new URL(req.url);
        const source = searchParams.get('source');
        const topic = searchParams.get('topic');
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        // Try Firestore first
        try {
            const db = getAdminDb();
            let query = db.collection('market_news')
                .orderBy('ts', 'desc')
                .limit(Math.min(limit, 100));

            if (source) {
                query = query.where('source', '==', source);
            }
            if (topic) {
                query = query.where('category', '==', topic);
            }

            const snapshot = await query.get();

            if (snapshot.docs.length > 0) {
                const articles = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        title: data.headline || '',
                        headline: data.headline || '',
                        summary: data.summary || '',
                        url: data.url || '',
                        source: data.source || 'Unknown',
                        category: data.category || 'general',
                        topic: data.category || 'general',
                        topics: [data.category || 'general'],
                        publishedAt: data.ts?.toDate?.()?.toISOString() || new Date().toISOString(),
                        ts: data.ts?.toDate?.()?.toISOString(),
                        image: data.image || null,
                        sentiment: { sentiment: 'neutral', score: 0.5 },
                        severity: 30,
                    };
                });

                return NextResponse.json({ articles, total: articles.length });
            }
        } catch {
            // Firestore unavailable, fall through to RSS
        }

        // Fallback: fetch from RSS aggregator
        try {
            const origin = req.nextUrl.origin;
            const rssRes = await fetch(`${origin}/api/news/rss`);
            if (rssRes.ok) {
                const rssData = await rssRes.json();
                const articles = (rssData.articles || []).map((a: Record<string, unknown>) => ({
                    id: a.id,
                    title: a.title,
                    headline: a.title,
                    summary: a.summary,
                    url: a.url,
                    source: a.source,
                    category: a.category || 'general',
                    topic: a.category || 'general',
                    topics: [a.category || 'general'],
                    publishedAt: a.publishedAt,
                    sentiment: { sentiment: a.sentiment || 'neutral', score: 0.5 },
                    severity: a.severity || 30,
                }));
                return NextResponse.json({ articles, total: articles.length, source: 'rss' });
            }
        } catch {
            // RSS also failed
        }

        return NextResponse.json({ articles: [], total: 0 });

    } catch (error) {
        console.error('News articles GET error:', error);
        return NextResponse.json(
            { error: 'Internal error', articles: [], total: 0 },
            { status: 500 }
        );
    }
}

