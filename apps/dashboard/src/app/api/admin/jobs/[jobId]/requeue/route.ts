/**
 * POST /api/admin/jobs/[jobId]/requeue - Requeue failed/dead job
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, hasRole, canAccessTenant } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface Params {
    params: { jobId: string };
}

export async function POST(req: NextRequest, { params }: Params) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasRole(auth.user, ['owner', 'admin'])) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { jobId } = params;

    try {
        const db = getAdminDb();
        const jobRef = db.collection('jobs').doc(jobId);
        const doc = await jobRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const data = doc.data();

        if (!canAccessTenant(auth.user, data?.tenantId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Only allow requeue for failed/dead status
        if (!['failed', 'dead'].includes(data?.status)) {
            return NextResponse.json({ error: 'Can only requeue failed or dead jobs' }, { status: 400 });
        }

        await jobRef.update({
            status: 'queued',
            attempts: 0,
            lastError: null,
            requeuedAt: FieldValue.serverTimestamp(),
            requeuedBy: auth.user.uid,
            updatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true, newStatus: 'queued' });

    } catch (error) {
        console.error('Requeue job error:', error);
        return NextResponse.json({ error: 'Failed to requeue job' }, { status: 500 });
    }
}
