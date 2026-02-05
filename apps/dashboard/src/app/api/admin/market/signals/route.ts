import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/market/signals
 * List recent market signals
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();
        const snapshot = await db.collection('market_signals')
            .orderBy('ts', 'desc')
            .limit(50)
            .get();

        const signals = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            ts: doc.data().ts?.toDate?.()?.toISOString(),
        }));

        return NextResponse.json({ signals });

    } catch (error) {
        console.error('Market signals GET error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
