/**
 * GET /api/lex/contracts — List contracts from Firestore
 * Fallback for when the gateway /agents/lex/contract is unavailable
 *
 * Firestore: contracts collection
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

        // Get contracts
        const contractsSnap = await db.collection('contracts')
            .orderBy('created_at', 'desc')
            .limit(50)
            .get();

        const contracts: Record<string, unknown>[] = contractsSnap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                ...d,
                created_at: d.created_at?.toDate?.()?.toISOString() || d.created_at,
                sign_date: d.sign_date || '',
                start_date: d.start_date || '',
                end_date: d.end_date || '',
            };
        });

        // Compute expiring contracts (within 30 days)
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const expiring_contracts = contracts
            .filter(c => {
                const endTime = new Date(String(c.end_date)).getTime();
                const remaining = endTime - now;
                return remaining > 0 && remaining <= thirtyDaysMs && c.status === 'active';
            })
            .map(c => ({
                id: c.id,
                title: c.title,
                end_date: c.end_date,
                days_remaining: Math.ceil((new Date(String(c.end_date)).getTime() - now) / (1000 * 60 * 60 * 24)),
                party: c.party,
                entity: c.entity,
            }));

        return NextResponse.json({ contracts, expiring_contracts });
    } catch (error) {
        console.error('Lex contracts API error:', error);
        return NextResponse.json({ error: 'Failed to load contracts', contracts: [], expiring_contracts: [] }, { status: 500 });
    }
}
