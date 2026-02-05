/**
 * GET /api/admin/rules/[ruleId] - Get rule details
 * PUT /api/admin/rules/[ruleId] - Update rule
 * DELETE /api/admin/rules/[ruleId] - Delete rule
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, hasRole, canAccessTenant } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface Params {
    params: { ruleId: string };
}

export async function GET(req: NextRequest, { params }: Params) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId');
    const { ruleId } = params;

    if (!tenantId) {
        return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    if (!canAccessTenant(auth.user, tenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const db = getAdminDb();
        const doc = await db.collection('tenants').doc(tenantId).collection('rules').doc(ruleId).get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data()?.createdAt?.toDate?.()?.toISOString(),
            updatedAt: doc.data()?.updatedAt?.toDate?.()?.toISOString(),
        });

    } catch (error) {
        console.error('Get rule error:', error);
        return NextResponse.json({ error: 'Failed to get rule' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: Params) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasRole(auth.user, ['owner', 'admin'])) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId');
    const { ruleId } = params;

    if (!tenantId) {
        return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    if (!canAccessTenant(auth.user, tenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { name, priority, enabled, match, route } = body;

        const db = getAdminDb();
        const ruleRef = db.collection('tenants').doc(tenantId).collection('rules').doc(ruleId);

        const doc = await ruleRef.get();
        if (!doc.exists) {
            return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
        }

        const updateData: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (name !== undefined) updateData.name = name;
        if (priority !== undefined) updateData.priority = priority;
        if (enabled !== undefined) updateData.enabled = enabled;
        if (match !== undefined) updateData.match = match;
        if (route !== undefined) updateData.route = route;

        await ruleRef.update(updateData);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Update rule error:', error);
        return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasRole(auth.user, ['owner', 'admin'])) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId');
    const { ruleId } = params;

    if (!tenantId) {
        return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    if (!canAccessTenant(auth.user, tenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const db = getAdminDb();
        const ruleRef = db.collection('tenants').doc(tenantId).collection('rules').doc(ruleId);

        const doc = await ruleRef.get();
        if (!doc.exists) {
            return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
        }

        await ruleRef.delete();

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete rule error:', error);
        return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
    }
}
