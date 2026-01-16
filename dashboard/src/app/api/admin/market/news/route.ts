import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/market/news
 * List recent market news
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();
        const snapshot = await db.collection('market_news')
            .orderBy('ts', 'desc')
            .limit(50)
            .get();

        const news = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            ts: doc.data().ts?.toDate?.()?.toISOString(),
        }));

        return NextResponse.json({ news });

    } catch (error) {
        console.error('Market news GET error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
