import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * DELETE /api/market/watchlist/[id]
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const { id } = await params;
        const db = getFirestore();
        await db
            .collection('watchlists')
            .doc(auth.uid)
            .collection('items')
            .doc(id)
            .delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Watchlist DELETE error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
