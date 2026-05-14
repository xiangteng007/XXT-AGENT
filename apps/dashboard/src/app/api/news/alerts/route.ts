/**
 * GET /api/news/alerts — List user's news alert rules
 * POST /api/news/alerts — Create a new news alert rule
 *
 * Firestore: users/{uid}/news_alert_rules
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
        const snap = await db.collection(`users/${auth.uid}/news_alert_rules`)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const rules = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        }));

        return NextResponse.json({ rules, total: rules.length });
    } catch (error) {
        console.error('News alerts GET error:', error);
        return NextResponse.json({ error: 'Failed to load news alert rules', rules: [] }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const body = await req.json();

        const rule = {
            name: body.name || '',
            enabled: body.enabled ?? true,
            keywords: body.keywords || [],
            symbols: body.symbols || [],
            minSeverity: body.minSeverity ?? 50,
            channels: {
                telegram: body.channels?.telegram ?? true,
                line: body.channels?.line ?? false,
                email: body.channels?.email ?? false,
            },
            cooldownMinutes: body.cooldownMinutes ?? 30,
            triggerCount: 0,
            createdAt: new Date(),
        };

        const docRef = await db.collection(`users/${auth.uid}/news_alert_rules`).add(rule);

        return NextResponse.json({
            id: docRef.id,
            ...rule,
            createdAt: rule.createdAt.toISOString(),
        }, { status: 201 });
    } catch (error) {
        console.error('News alerts POST error:', error);
        return NextResponse.json({ error: 'Failed to create news alert rule' }, { status: 500 });
    }
}
