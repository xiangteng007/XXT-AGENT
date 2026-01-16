import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * PATCH /api/admin/market/watchlist/[id]
 * Update a watchlist item
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

        const body = await req.json();
        const db = getFirestore();

        await db
            .collection('watchlists')
            .doc(authResult.uid)
            .collection('items')
            .doc(params.id)
            .update({
                ...body,
                updatedAt: FieldValue.serverTimestamp(),
            });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Watchlist PATCH error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/market/watchlist/[id]
 * Remove a watchlist item
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

        const db = getFirestore();

        await db
            .collection('watchlists')
            .doc(authResult.uid)
            .collection('items')
            .doc(params.id)
            .delete();

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Watchlist DELETE error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
