/**
 * GET /api/admin/mappings/[mappingId] - Get mapping details
 * PUT /api/admin/mappings/[mappingId] - Update mapping
 * DELETE /api/admin/mappings/[mappingId] - Delete mapping
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, hasRole, canAccessTenant } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface Params {
    params: { mappingId: string };
}

export async function GET(req: NextRequest, { params }: Params) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId');
    const { mappingId } = params;

    if (!tenantId) {
        return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    if (!canAccessTenant(auth.user, tenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const db = getAdminDb();
        const doc = await db.collection('tenants').doc(tenantId).collection('mappings').doc(mappingId).get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data()?.createdAt?.toDate?.()?.toISOString(),
            updatedAt: doc.data()?.updatedAt?.toDate?.()?.toISOString(),
        });

    } catch (error) {
        console.error('Get mapping error:', error);
        return NextResponse.json({ error: 'Failed to get mapping' }, { status: 500 });
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
    const { mappingId } = params;

    if (!tenantId) {
        return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    if (!canAccessTenant(auth.user, tenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { databaseId, fields, defaults } = body;

        const db = getAdminDb();
        const mappingRef = db.collection('tenants').doc(tenantId).collection('mappings').doc(mappingId);

        const doc = await mappingRef.get();
        if (!doc.exists) {
            return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
        }

        const updateData: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (databaseId !== undefined) updateData.databaseId = databaseId;
        if (fields !== undefined) updateData.fields = fields;
        if (defaults !== undefined) updateData.defaults = defaults;

        await mappingRef.update(updateData);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Update mapping error:', error);
        return NextResponse.json({ error: 'Failed to update mapping' }, { status: 500 });
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
    const { mappingId } = params;

    if (!tenantId) {
        return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    if (!canAccessTenant(auth.user, tenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const db = getAdminDb();
        const mappingRef = db.collection('tenants').doc(tenantId).collection('mappings').doc(mappingId);

        const doc = await mappingRef.get();
        if (!doc.exists) {
            return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
        }

        await mappingRef.delete();

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete mapping error:', error);
        return NextResponse.json({ error: 'Failed to delete mapping' }, { status: 500 });
    }
}
