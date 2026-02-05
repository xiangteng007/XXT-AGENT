/**
 * POST /api/admin/jobs/[jobId]/ignore - Mark job as ignored
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

        await jobRef.update({
            status: 'ignored',
            ignoredAt: FieldValue.serverTimestamp(),
            ignoredBy: auth.user.uid,
            updatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true, newStatus: 'ignored' });

    } catch (error) {
        console.error('Ignore job error:', error);
        return NextResponse.json({ error: 'Failed to ignore job' }, { status: 500 });
    }
}
