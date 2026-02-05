/**
 * GET /api/admin/rules - List rules for a tenant
 * POST /api/admin/rules - Create new rule
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, hasRole, canAccessTenant } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { validateRuleMatch, validateRuleRoute } from '@/lib/validators';

export async function GET(req: NextRequest) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId');

    if (!tenantId) {
        return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    if (!canAccessTenant(auth.user, tenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const db = getAdminDb();
        const rulesRef = db.collection('tenants').doc(tenantId).collection('rules');
        const snapshot = await rulesRef.orderBy('priority', 'desc').get();

        const rules = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
        }));

        return NextResponse.json({ rules });

    } catch (error) {
        console.error('List rules error:', error);
        return NextResponse.json({ error: 'Failed to list rules' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasRole(auth.user, ['owner', 'admin'])) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { tenantId, name, priority, enabled, match, route } = body;

        if (!tenantId || !name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!canAccessTenant(auth.user, tenantId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Validate match
        const matchValid = validateRuleMatch(match);
        if (!matchValid.valid) {
            return NextResponse.json({ error: matchValid.error }, { status: 400 });
        }

        // Validate route
        const routeValid = validateRuleRoute(route);
        if (!routeValid.valid) {
            return NextResponse.json({ error: routeValid.error }, { status: 400 });
        }

        const db = getAdminDb();
        const rulesRef = db.collection('tenants').doc(tenantId).collection('rules');

        const ruleData = {
            name,
            priority: priority ?? 0,
            enabled: enabled ?? true,
            match: {
                type: match.type,
                value: match.value,
                caseSensitive: match.caseSensitive ?? false,
            },
            route: {
                databaseId: route.databaseId,
                templateId: route.templateId || '',
                tags: route.tags || [],
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        const docRef = await rulesRef.add(ruleData);

        return NextResponse.json({
            id: docRef.id,
            ...ruleData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, { status: 201 });

    } catch (error) {
        console.error('Create rule error:', error);
        return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
    }
}
