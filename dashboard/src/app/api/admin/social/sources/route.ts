import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/social/sources
 * List social sources for a tenant
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

        const snapshot = await db
            .collection('social_sources')
            .doc(tenantId)
            .collection('sources')
            .orderBy('createdAt', 'desc')
            .get();

        const sources = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
        }));

        return NextResponse.json({ sources });

    } catch (error) {
        console.error('Sources GET error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/admin/social/sources
 * Create a new social source
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
        const { tenantId, platform, mode, config, enabled } = body;

        if (!platform) {
            return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
        }

        const db = getFirestore();
        const docRef = await db
            .collection('social_sources')
            .doc(tenantId || 'default')
            .collection('sources')
            .add({
                tenantId: tenantId || 'default',
                platform,
                mode: mode || 'poll',
                config: config || {},
                enabled: enabled !== false,
                credentialsRef: '',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

        return NextResponse.json({ id: docRef.id, success: true });

    } catch (error) {
        console.error('Sources POST error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
