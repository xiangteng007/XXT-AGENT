import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/market/macro-calendar
 * Returns upcoming macroeconomic events from Firestore or external data source.
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();

        // Fetch upcoming macro events (next 14 days)
        const now = new Date();
        const twoWeeksLater = new Date(now);
        twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

        const snapshot = await db.collection('macro_events')
            .where('date', '>=', now.toISOString().split('T')[0])
            .where('date', '<=', twoWeeksLater.toISOString().split('T')[0])
            .orderBy('date', 'asc')
            .limit(50)
            .get();

        const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({ events });

    } catch (error) {
        console.error('Macro calendar error:', error);

        // Return empty array if collection doesn't exist yet
        return NextResponse.json({ events: [] });
    }
}
