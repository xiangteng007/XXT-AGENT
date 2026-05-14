import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/events
 * Returns fused events from Firestore (fusion-engine output).
 * Supports query params: limit, domain, minSeverity
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
        const domain = searchParams.get('domain');
        const minSeverity = parseInt(searchParams.get('minSeverity') || '0', 10);

        const db = getFirestore();
        let query = db.collection('fused_events')
            .orderBy('ts', 'desc')
            .limit(limit);

        if (domain && domain !== 'all') {
            query = query.where('domain', '==', domain);
        }

        if (minSeverity > 0) {
            query = query.where('severity', '>=', minSeverity);
        }

        const snapshot = await query.get();
        const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json(events);

    } catch (error) {
        console.error('Events API error:', error);
        return NextResponse.json([], { status: 200 }); // Return empty array on error
    }
}
