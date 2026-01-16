import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * POST /api/admin/social/backfill
 * Trigger backfill for a source (fetch historical data)
 */
export async function POST(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        if (authResult.role === 'viewer') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { tenantId, sourceId, fromDate, toDate } = body;

        if (!sourceId) {
            return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });
        }

        const db = getFirestore();

        // Verify source exists
        const sourceDoc = await db
            .collection('social_sources')
            .doc(tenantId || 'default')
            .collection('sources')
            .doc(sourceId)
            .get();

        if (!sourceDoc.exists) {
            return NextResponse.json({ error: 'Source not found' }, { status: 404 });
        }

        // Create backfill job
        const jobRef = await db.collection('backfill_jobs').add({
            tenantId: tenantId || 'default',
            sourceId,
            fromDate: fromDate || null,
            toDate: toDate || null,
            status: 'pending',
            createdBy: authResult.uid,
            createdAt: FieldValue.serverTimestamp(),
            startedAt: null,
            completedAt: null,
            result: null,
        });

        // TODO: Enqueue Cloud Task to process backfill
        // This would call the social-collector-worker with backfill flag

        return NextResponse.json({
            success: true,
            jobId: jobRef.id,
            message: 'Backfill job created. Processing will start shortly.',
        });

    } catch (error) {
        console.error('Backfill POST error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * GET /api/admin/social/backfill
 * List backfill jobs
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();
        const searchParams = req.nextUrl.searchParams;
        const tenantId = searchParams.get('tenantId') || 'default';

        const snapshot = await db.collection('backfill_jobs')
            .where('tenantId', '==', tenantId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const jobs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
            startedAt: doc.data().startedAt?.toDate?.()?.toISOString(),
            completedAt: doc.data().completedAt?.toDate?.()?.toISOString(),
        }));

        return NextResponse.json({ jobs });

    } catch (error) {
        console.error('Backfill GET error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
