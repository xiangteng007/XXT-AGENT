import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/social/stats
 * Get social monitoring statistics
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();

        // Get counts
        const postsRef = db.collection('social_posts');

        // Total count (approximate using aggregation or limited fetch)
        const allSnapshot = await postsRef.limit(10000).get();
        const total = allSnapshot.size;

        // Today's posts
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySnapshot = await postsRef
            .where('createdAt', '>=', today)
            .get();
        const postsToday = todaySnapshot.size;

        // Today's alerts (severity >= 70)
        const alertsSnapshot = await postsRef
            .where('createdAt', '>=', today)
            .where('severity', '>=', 70)
            .get();
        const alertsToday = alertsSnapshot.size;

        // Aggregate by platform and sentiment
        const byPlatform: Record<string, number> = {};
        const bySentiment: Record<string, number> = {};
        const keywordCounts: Record<string, number> = {};
        let totalUrgency = 0;
        let totalSeverity = 0;

        allSnapshot.docs.forEach(doc => {
            const data = doc.data();

            // Platform
            const platform = data.platform || 'unknown';
            byPlatform[platform] = (byPlatform[platform] || 0) + 1;

            // Sentiment
            const sentiment = data.sentiment || 'neutral';
            bySentiment[sentiment] = (bySentiment[sentiment] || 0) + 1;

            // Urgency/Severity
            totalUrgency += data.urgency || 0;
            totalSeverity += data.severity || 0;

            // Keywords
            (data.keywords || []).forEach((kw: string) => {
                keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
            });
        });

        const avgUrgency = total > 0 ? totalUrgency / total : 0;
        const avgSeverity = total > 0 ? totalSeverity / total : 0;

        // Top keywords
        const topKeywords = Object.entries(keywordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([keyword, count]) => ({ keyword, count }));

        return NextResponse.json({
            total,
            byPlatform,
            bySentiment,
            avgUrgency,
            avgSeverity,
            postsToday,
            alertsToday,
            topKeywords,
        });

    } catch (error) {
        console.error('Social stats API error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
