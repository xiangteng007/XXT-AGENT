/**
 * GET /api/admin/jobs/[jobId] - Get job details
 * POST /api/admin/jobs/[jobId]/requeue - Requeue failed job
 * POST /api/admin/jobs/[jobId]/ignore - Mark job as ignored
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, hasRole, canAccessTenant } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface Params {
    params: { jobId: string };
}

export async function GET(req: NextRequest, { params }: Params) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = params;

    try {
        const db = getAdminDb();
        const doc = await db.collection('jobs').doc(jobId).get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const data = doc.data();

        // Check tenant access
        if (!canAccessTenant(auth.user, data?.tenantId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({
            id: doc.id,
            ...data,
            createdAt: data?.createdAt?.toDate?.()?.toISOString(),
            updatedAt: data?.updatedAt?.toDate?.()?.toISOString(),
        });

    } catch (error) {
        console.error('Get job error:', error);
        return NextResponse.json({ error: 'Failed to get job' }, { status: 500 });
    }
}
