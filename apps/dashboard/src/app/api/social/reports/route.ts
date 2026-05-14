/**
 * GET /api/social/reports — List social monitoring reports
 * 
 * Reads from Firestore: social_reports collection
 * Falls back to deriving reports from social_posts aggregate stats
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    try {
        const db = getAdminDb();

        // Try to get saved reports
        const reportsSnap = await db.collection('social_reports')
            .orderBy('generatedAt', 'desc')
            .limit(20)
            .get();

        if (reportsSnap.docs.length > 0) {
            const reports = reportsSnap.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    name: d.name || '',
                    type: d.type || 'daily',
                    status: d.status || 'completed',
                    generatedAt: d.generatedAt?.toDate?.()?.toISOString() || d.generatedAt,
                    period: {
                        start: d.period?.start || '',
                        end: d.period?.end || '',
                    },
                    metrics: {
                        totalPosts: d.metrics?.totalPosts || 0,
                        avgSentiment: d.metrics?.avgSentiment || 0,
                        topAccounts: d.metrics?.topAccounts || 0,
                        alerts: d.metrics?.alerts || 0,
                    },
                    downloadUrls: d.downloadUrls || {},
                };
            });

            return NextResponse.json({ reports, total: reports.length });
        }

        // Fallback: generate a live summary report from social_posts
        const postsRef = db.collection('social_posts');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todaySnap = await postsRef
            .where('createdAt', '>=', today)
            .limit(5000)
            .get();

        const totalPosts = todaySnap.size;
        let sentimentSum = 0;
        let alertCount = 0;
        const platforms = new Set<string>();

        todaySnap.docs.forEach(doc => {
            const d = doc.data();
            sentimentSum += d.sentiment_score ?? 0.5;
            if ((d.severity ?? 0) >= 70) alertCount++;
            if (d.platform) platforms.add(d.platform);
        });

        const liveReport = {
            id: 'live-today',
            name: '今日即時社群監控',
            type: 'daily',
            status: 'completed',
            generatedAt: new Date().toISOString(),
            period: {
                start: today.toISOString().split('T')[0],
                end: today.toISOString().split('T')[0],
            },
            metrics: {
                totalPosts,
                avgSentiment: totalPosts > 0 ? sentimentSum / totalPosts : 0,
                topAccounts: platforms.size,
                alerts: alertCount,
            },
        };

        return NextResponse.json({ reports: [liveReport], total: 1, source: 'live' });
    } catch (error) {
        console.error('Social reports API error:', error);
        return NextResponse.json({ error: 'Failed to load reports', reports: [] }, { status: 500 });
    }
}
