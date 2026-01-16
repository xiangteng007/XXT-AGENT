/**
 * GET /api/admin/metrics - Get daily metrics
 * Query params: tenantId, date (yyyyMMdd)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, canAccessTenant } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

export async function GET(req: NextRequest) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId');
    const dateParam = req.nextUrl.searchParams.get('date');

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = dateParam || formatDate(today);
    const yesterdayStr = formatDate(yesterday);

    try {
        const db = getAdminDb();

        // Default empty metrics
        const emptyMetrics = {
            ok_count: 0,
            failed_count: 0,
            dlq_count: 0,
            notion_429: 0,
            notion_5xx: 0,
            avg_latency_ms: 0,
        };

        if (tenantId) {
            if (!canAccessTenant(auth.user, tenantId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const todayDocId = `${tenantId}_${todayStr}`;
            const yesterdayDocId = `${tenantId}_${yesterdayStr}`;

            const [todayDoc, yesterdayDoc] = await Promise.all([
                db.collection('metrics_daily').doc(todayDocId).get(),
                db.collection('metrics_daily').doc(yesterdayDocId).get(),
            ]);

            return NextResponse.json({
                tenantId,
                today: {
                    date: todayStr,
                    ...(todayDoc.exists ? todayDoc.data() : emptyMetrics),
                },
                yesterday: {
                    date: yesterdayStr,
                    ...(yesterdayDoc.exists ? yesterdayDoc.data() : emptyMetrics),
                },
            });
        }

        // Aggregate across all accessible tenants
        let tenants: string[] = [];
        if (auth.user.allowTenants.length > 0) {
            tenants = auth.user.allowTenants;
        } else {
            const tenantsSnap = await db.collection('tenants').limit(100).get();
            tenants = tenantsSnap.docs.map(d => d.id);
        }

        const todayMetrics = { ...emptyMetrics };
        const yesterdayMetrics = { ...emptyMetrics };

        for (const tid of tenants.slice(0, 20)) {
            const todayDocId = `${tid}_${todayStr}`;
            const yesterdayDocId = `${tid}_${yesterdayStr}`;

            const [todayDoc, yesterdayDoc] = await Promise.all([
                db.collection('metrics_daily').doc(todayDocId).get(),
                db.collection('metrics_daily').doc(yesterdayDocId).get(),
            ]);

            if (todayDoc.exists) {
                const d = todayDoc.data() as typeof emptyMetrics;
                todayMetrics.ok_count += d.ok_count || 0;
                todayMetrics.failed_count += d.failed_count || 0;
                todayMetrics.dlq_count += d.dlq_count || 0;
                todayMetrics.notion_429 += d.notion_429 || 0;
                todayMetrics.notion_5xx += d.notion_5xx || 0;
            }

            if (yesterdayDoc.exists) {
                const d = yesterdayDoc.data() as typeof emptyMetrics;
                yesterdayMetrics.ok_count += d.ok_count || 0;
                yesterdayMetrics.failed_count += d.failed_count || 0;
                yesterdayMetrics.dlq_count += d.dlq_count || 0;
                yesterdayMetrics.notion_429 += d.notion_429 || 0;
                yesterdayMetrics.notion_5xx += d.notion_5xx || 0;
            }
        }

        return NextResponse.json({
            tenantId: null,
            tenantsIncluded: tenants.length,
            today: { date: todayStr, ...todayMetrics },
            yesterday: { date: yesterdayStr, ...yesterdayMetrics },
        });

    } catch (error) {
        console.error('Get metrics error:', error);
        return NextResponse.json({ error: 'Failed to get metrics' }, { status: 500 });
    }
}
