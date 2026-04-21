import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * PATCH /api/market/signals/[id]/dismiss
 */
export async function PATCH(
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

        await db.collection('market_signals').doc(id).update({
            isDismissed: true,
            dismissedAt: new Date(),
            dismissedBy: auth.uid,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Signal dismiss error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
