import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/news/articles
 * List recent news articles from market_news collection
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

        const db = getAdminDb();
        let query = db.collection('market_news')
            .orderBy('ts', 'desc')
            .limit(Math.min(limit, 100));


        // Apply filters if provided
        if (source) {
            query = query.where('source', '==', source);
        }
        if (topic) {
            query = query.where('category', '==', topic);
        }

        const snapshot = await query.get();

        const articles = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                headline: data.headline || '',
                summary: data.summary || '',
                url: data.url || '',
                source: data.source || 'Unknown',
                category: data.category || 'general',
                topic: data.category || 'general', // Alias for frontend
                publishedAt: data.ts?.toDate?.()?.toISOString() || new Date().toISOString(),
                ts: data.ts?.toDate?.()?.toISOString(),
                image: data.image || null,
            };
        });

        return NextResponse.json({
            articles,
            total: articles.length,
        });

    } catch (error) {
        console.error('News articles GET error:', error);
        return NextResponse.json(
            { error: 'Internal error', articles: [], total: 0 },
            { status: 500 }
        );
    }
}
