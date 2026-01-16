/**
 * GET /api/admin/jobs - List jobs
 * Query params: tenantId, status, limit
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, canAccessTenant } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId');
    const status = req.nextUrl.searchParams.get('status');
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = parseInt(limitParam || '50', 10);

    try {
        const db = getAdminDb();
        let query = db.collection('jobs').orderBy('createdAt', 'desc').limit(limit);

        if (tenantId) {
            if (!canAccessTenant(auth.user, tenantId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            query = query.where('tenantId', '==', tenantId);
        } else if (auth.user.allowTenants.length > 0) {
            // Limit to allowed tenants
            query = query.where('tenantId', 'in', auth.user.allowTenants.slice(0, 10));
        }

        if (status) {
            // Re-create query with status filter
            query = db.collection('jobs')
                .where('status', '==', status)
                .orderBy('createdAt', 'desc')
                .limit(limit);

            if (tenantId) {
                query = query.where('tenantId', '==', tenantId);
            }
        }

        const snapshot = await query.get();

        const jobs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
            // Mask payload for listing
            payload: doc.data().payload ? '[REDACTED]' : null,
        }));

        return NextResponse.json({ jobs });

    } catch (error) {
        console.error('List jobs error:', error);
        return NextResponse.json({ error: 'Failed to list jobs' }, { status: 500 });
    }
}
