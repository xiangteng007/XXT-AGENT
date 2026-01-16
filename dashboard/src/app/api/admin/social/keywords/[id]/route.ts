import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * PATCH /api/admin/social/keywords/[id]
 * Update a keyword
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
        const db = getFirestore();

        await db.collection('social_keywords').doc(params.id).update({
            ...body,
            updatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Keywords PATCH error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/social/keywords/[id]
 * Delete a keyword
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

        const db = getFirestore();
        await db.collection('social_keywords').doc(params.id).delete();

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Keywords DELETE error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
