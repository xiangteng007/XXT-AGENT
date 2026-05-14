/**
 * GET /api/market/alerts - List user's market alert rules
 * POST /api/market/alerts - Create a new alert rule
 * 
 * Stores alert rules in Firestore: users/{uid}/alert_rules
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

        const snap = await db.collection(`users/${uid}/alert_rules`)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const rules = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
            lastTriggered: doc.data().lastTriggered?.toDate?.()?.toISOString() || doc.data().lastTriggered,
        }));

        return NextResponse.json({ rules, total: rules.length });
    } catch (error) {
        console.error('Market alerts GET error:', error);
        return NextResponse.json({ error: 'Failed to load alert rules', rules: [] }, { status: 500 });
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

        const rule = {
            symbol: body.symbol || '',
            name: body.name || `${body.symbol} Alert`,
            type: body.type || 'price_above', // price_above, price_below, pct_change, volume_spike
            condition: body.condition || {},
            enabled: body.enabled ?? true,
            notifyTelegram: body.notifyTelegram ?? true,
            notifyLine: body.notifyLine ?? false,
            triggerCount: 0,
            lastTriggered: null,
            createdAt: new Date(),
        };

        const docRef = await db.collection(`users/${uid}/alert_rules`).add(rule);

        return NextResponse.json({
            id: docRef.id,
            ...rule,
            createdAt: rule.createdAt.toISOString(),
        }, { status: 201 });
    } catch (error) {
        console.error('Market alerts POST error:', error);
        return NextResponse.json({ error: 'Failed to create alert rule' }, { status: 500 });
    }
}
