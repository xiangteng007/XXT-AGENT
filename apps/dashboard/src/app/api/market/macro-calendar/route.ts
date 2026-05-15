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

        // Fetch macro events: 7 days back + 30 days forward
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthLater = new Date(now);
        monthLater.setDate(monthLater.getDate() + 30);

        const snapshot = await db.collection('macro_events')
            .where('date', '>=', weekAgo.toISOString().split('T')[0])
            .where('date', '<=', monthLater.toISOString().split('T')[0])
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
