import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/market/watchlist — list user's watchlist
 * POST /api/market/watchlist — add item
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const db = getFirestore();
        const snap = await db
            .collection('watchlists')
            .doc(auth.uid)
            .collection('items')
            .orderBy('createdAt', 'desc')
            .get();

        const items = snap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                symbol: d.symbol ?? doc.id,
                name: d.name ?? d.symbol ?? doc.id,
                type: d.assetClass ?? 'stock',
                alertPrice: d.thresholds?.spikePct1m,
                notes: d.notes ?? '',
                tags: d.tags ?? [],
                group: d.group ?? 'default',
                sortOrder: d.sortOrder ?? 0,
                addedAt: d.createdAt?.toDate?.()?.toISOString() ?? '',
            };
        });

        // Extract distinct groups
        const groupSet = new Set(items.map(i => i.group));
        const groups = Array.from(groupSet).map((g, idx) => ({
            id: g,
            name: g,
            color: '#D97706',
            sortOrder: idx,
            itemCount: items.filter(i => i.group === g).length,
        }));

        return NextResponse.json({ items, groups });
    } catch (error) {
        console.error('Watchlist GET error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth.success) {
            return NextResponse.json({ error: auth.error }, { status: 401 });
        }

        const body = await req.json() as {
            symbol?: string;
            group?: string;
            notes?: string;
        };

        if (!body.symbol) {
            return NextResponse.json({ error: 'symbol required' }, { status: 400 });
        }

        const db = getFirestore();
        const symbol = body.symbol.toUpperCase();

        await db
            .collection('watchlists')
            .doc(auth.uid)
            .collection('items')
            .doc(symbol)
            .set(
                {
                    symbol,
                    assetClass: 'stock',
                    enabled: true,
                    group: body.group ?? 'default',
                    notes: body.notes ?? '',
                    thresholds: { spikePct1m: 0.8, spikePct5m: 1.5, volumeSpikeFactor: 2.0 },
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );

        return NextResponse.json({ id: symbol, success: true });
    } catch (error) {
        console.error('Watchlist POST error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
