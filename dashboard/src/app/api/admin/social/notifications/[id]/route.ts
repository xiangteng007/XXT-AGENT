import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * PATCH /api/admin/social/notifications/[id]
 * Update a notification setting
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

        await db.collection('social_notifications').doc(params.id).update({
            ...body,
            updatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Notifications PATCH error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * PUT /api/admin/social/notifications/[id]
 * Full update of notification setting
 */
export async function PUT(
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

        await db.collection('social_notifications').doc(params.id).set({
            ...body,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Notifications PUT error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/social/notifications/[id]
 * Delete a notification setting
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
        await db.collection('social_notifications').doc(params.id).delete();

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Notifications DELETE error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
