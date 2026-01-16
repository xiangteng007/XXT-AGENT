import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/fused-events
 * List recent fused events (for notification popup)
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();
        const searchParams = req.nextUrl.searchParams;

        const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);
        const domain = searchParams.get('domain');

        let query: FirebaseFirestore.Query = db.collection('fused_events')
            .orderBy('ts', 'desc');

        if (domain) {
            query = query.where('domain', '==', domain);
        }

        query = query.limit(limit);

        const snapshot = await query.get();
        const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            ts: doc.data().ts?.toDate?.()?.toISOString() || doc.data().ts,
        }));

        return NextResponse.json({ events });

    } catch (error) {
        console.error('Fused events API error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
