import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/social/export
 * Export social posts as CSV or JSON
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();
        const searchParams = req.nextUrl.searchParams;

        const format = searchParams.get('format') || 'json';
        const platform = searchParams.get('platform');
        const limit = Math.min(Number(searchParams.get('limit')) || 1000, 5000);

        let query: FirebaseFirestore.Query = db.collection('social_posts')
            .orderBy('createdAt', 'desc');

        if (platform && platform !== 'all') {
            query = query.where('platform', '==', platform);
        }

        query = query.limit(limit);

        const snapshot = await query.get();
        const posts = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                platform: data.platform,
                title: data.title,
                summary: data.summary,
                author: data.author,
                url: data.url,
                sentiment: data.sentiment,
                urgency: data.urgency,
                severity: data.severity,
                keywords: data.keywords?.join('; ') || '',
                location: data.location || '',
                likes: data.engagement?.likes || 0,
                comments: data.engagement?.comments || 0,
                shares: data.engagement?.shares || 0,
                views: data.engagement?.views || 0,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            };
        });

        if (format === 'csv') {
            // Generate CSV
            const headers = Object.keys(posts[0] || {});
            const csvRows = [
                headers.join(','),
                ...posts.map(post =>
                    headers.map(h => {
                        const val = (post as any)[h];
                        // Escape quotes and wrap in quotes if contains comma
                        const str = String(val ?? '');
                        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                            return `"${str.replace(/"/g, '""')}"`;
                        }
                        return str;
                    }).join(',')
                ),
            ].join('\n');

            return new NextResponse(csvRows, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="social_posts_${new Date().toISOString().slice(0, 10)}.csv"`,
                },
            });
        }

        // JSON format
        return new NextResponse(JSON.stringify(posts, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="social_posts_${new Date().toISOString().slice(0, 10)}.json"`,
            },
        });

    } catch (error) {
        console.error('Social export API error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
