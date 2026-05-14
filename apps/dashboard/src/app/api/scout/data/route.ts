/**
 * GET /api/scout/data — Aggregated Scout (UAV) data
 *
 * Returns missions, equipment, and pilots from Firestore
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    try {
        const db = getAdminDb();

        const [missionsSnap, equipmentSnap, pilotsSnap] = await Promise.all([
            db.collection('scout_missions').orderBy('flight_date', 'desc').limit(50).get(),
            db.collection('scout_equipment').limit(20).get(),
            db.collection('scout_pilots').limit(20).get(),
        ]);

        const toData = (snap: FirebaseFirestore.QuerySnapshot) =>
            snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json({
            missions: toData(missionsSnap),
            equipment: toData(equipmentSnap),
            pilots: toData(pilotsSnap),
        });
    } catch (error) {
        console.error('Scout data API error:', error);
        return NextResponse.json({
            error: 'Failed to load Scout data',
            missions: [], equipment: [], pilots: [],
        }, { status: 500 });
    }
}
