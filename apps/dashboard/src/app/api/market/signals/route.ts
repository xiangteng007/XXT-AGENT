import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/market/signals
 * Returns market signals from Firestore, ordered by timestamp.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const db = getFirestore();
        const snap = await db
            .collection('market_signals')
            .orderBy('ts', 'desc')
            .limit(100)
            .get();

        const signals = snap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                symbol: d.symbol ?? '',
                type: d.signalType ?? 'custom',
                direction: d.direction ?? 'neutral',
                strength: d.confidence >= 70 ? 'strong' : d.confidence >= 40 ? 'medium' : 'weak',
                title: d.rationale?.slice(0, 60) ?? `${d.signalType} on ${d.symbol}`,
                description: d.rationale ?? '',
                price: d.price ?? 0,
                target: d.target,
                stopLoss: d.riskControls?.stopLoss,
                detectedAt: d.ts?.toDate?.()?.toISOString() ?? '',
                isRead: d.isRead ?? false,
                isDismissed: d.isDismissed ?? false,
            };
        });

        return NextResponse.json({ signals });
    } catch (error) {
        console.error('Market signals error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
