/**
 * GET /api/zora/data — Aggregated Zora (NGO) data
 *
 * Returns donations, volunteers, projects, and rescue missions from Firestore
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

        const [donationsSnap, volunteersSnap, projectsSnap, missionsSnap] = await Promise.all([
            db.collection('zora_donations').orderBy('date', 'desc').limit(50).get(),
            db.collection('zora_volunteers').orderBy('join_date', 'desc').limit(50).get(),
            db.collection('zora_projects').orderBy('start_date', 'desc').limit(20).get(),
            db.collection('zora_missions').orderBy('start_date', 'desc').limit(20).get(),
        ]);

        const toData = (snap: FirebaseFirestore.QuerySnapshot) =>
            snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json({
            donations: toData(donationsSnap),
            volunteers: toData(volunteersSnap),
            projects: toData(projectsSnap),
            missions: toData(missionsSnap),
        });
    } catch (error) {
        console.error('Zora data API error:', error);
        return NextResponse.json({
            error: 'Failed to load Zora data',
            donations: [], volunteers: [], projects: [], missions: [],
        }, { status: 500 });
    }
}
