/**
 * GET /api/guardian/policies - List all policies for the authenticated user
 * POST /api/guardian/policies - Create a new policy
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const auth = await verifyAuthToken(req);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const uid = auth.user.uid;

        const snap = await db.collection(`users/${uid}/policies`)
            .orderBy('coverage_end', 'desc')
            .get();

        const policies = snap.docs.map(doc => ({
            policy_id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({ policies });
    } catch (error) {
        console.error('Guardian GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch policies' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await verifyAuthToken(req);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const uid = auth.user.uid;
        const body = await req.json();

        const { policy_name, insurer, status, ledger_linked, annual_premium, currency, coverage_start, coverage_end } = body;

        if (!policy_name || !insurer) {
            return NextResponse.json({ error: 'policy_name and insurer are required' }, { status: 400 });
        }

        const docRef = await db.collection(`users/${uid}/policies`).add({
            policy_name,
            insurer,
            status: status || 'active',
            ledger_linked: ledger_linked ?? false,
            annual_premium: annual_premium || 0,
            currency: currency || 'NTD',
            coverage_start: coverage_start || '',
            coverage_end: coverage_end || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        return NextResponse.json({
            policy_id: docRef.id,
            message: 'Policy created successfully',
        }, { status: 201 });
    } catch (error) {
        console.error('Guardian POST error:', error);
        return NextResponse.json({ error: 'Failed to create policy' }, { status: 500 });
    }
}
