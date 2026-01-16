/**
 * GET /api/admin/stats - Dashboard statistics
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getAdminDb();

        // Count tenants
        const tenantsSnap = await db.collection('tenants').count().get();
        const tenantsCount = tenantsSnap.data().count;

        // Count rules (across all tenants)
        const rulesSnap = await db.collectionGroup('rules').count().get();
        const rulesCount = rulesSnap.data().count;

        // Count today's jobs
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const jobsSnap = await db.collection('jobs')
            .where('createdAt', '>=', today)
            .count()
            .get();
        const jobsToday = jobsSnap.data().count;

        // Calculate success rate from today's jobs
        const successSnap = await db.collection('jobs')
            .where('createdAt', '>=', today)
            .where('status', '==', 'done')
            .count()
            .get();
        const successCount = successSnap.data().count;
        const successRate = jobsToday > 0 ? Math.round((successCount / jobsToday) * 100) : 100;

        return NextResponse.json({
            tenantsCount,
            rulesCount,
            jobsToday,
            successRate,
        });

    } catch (error) {
        console.error('Stats error:', error);
        return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
    }
}
