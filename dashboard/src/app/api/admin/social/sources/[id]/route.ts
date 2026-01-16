import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/social/sources/[id]
 * Get a single source
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const searchParams = req.nextUrl.searchParams;
        const tenantId = searchParams.get('tenantId') || 'default';

        const db = getFirestore();
        const doc = await db
            .collection('social_sources')
            .doc(tenantId)
            .collection('sources')
            .doc(params.id)
            .get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Source not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data()?.createdAt?.toDate?.()?.toISOString(),
            updatedAt: doc.data()?.updatedAt?.toDate?.()?.toISOString(),
        });

    } catch (error) {
        console.error('Sources GET error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/social/sources/[id]
 * Update a source
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        if (authResult.role === 'viewer') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const searchParams = req.nextUrl.searchParams;
        const tenantId = searchParams.get('tenantId') || body.tenantId || 'default';

        const db = getFirestore();
        await db
            .collection('social_sources')
            .doc(tenantId)
            .collection('sources')
            .doc(params.id)
            .update({
                ...body,
                updatedAt: FieldValue.serverTimestamp(),
            });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Sources PATCH error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/social/sources/[id]
 * Delete a source
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        if (authResult.role === 'viewer') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const searchParams = req.nextUrl.searchParams;
        const tenantId = searchParams.get('tenantId') || 'default';

        const db = getFirestore();
        await db
            .collection('social_sources')
            .doc(tenantId)
            .collection('sources')
            .doc(params.id)
            .delete();

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Sources DELETE error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
