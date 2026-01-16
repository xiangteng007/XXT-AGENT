import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/market/watchlist
 * List user's watchlist items
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();
        const snapshot = await db
            .collection('watchlists')
            .doc(authResult.uid)
            .collection('items')
            .orderBy('createdAt', 'desc')
            .get();

        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
        }));

        return NextResponse.json({ items });

    } catch (error) {
        console.error('Watchlist GET error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/admin/market/watchlist
 * Add a new watchlist item
 */
export async function POST(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const body = await req.json();
        const { symbol, assetClass, enabled, thresholds } = body;

        if (!symbol) {
            return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
        }

        const db = getFirestore();
        const docRef = await db
            .collection('watchlists')
            .doc(authResult.uid)
            .collection('items')
            .doc(symbol.toUpperCase())
            .set({
                symbol: symbol.toUpperCase(),
                assetClass: assetClass || 'stock',
                enabled: enabled !== false,
                thresholds: thresholds || {
                    spikePct1m: 0.8,
                    spikePct5m: 1.5,
                    volumeSpikeFactor: 2.0,
                },
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

        return NextResponse.json({ id: symbol.toUpperCase(), success: true });

    } catch (error) {
        console.error('Watchlist POST error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
