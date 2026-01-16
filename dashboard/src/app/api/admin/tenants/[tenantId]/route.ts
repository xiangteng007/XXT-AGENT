/**
 * GET /api/admin/tenants/[tenantId] - Get tenant details
 * PUT /api/admin/tenants/[tenantId] - Update tenant
 * DELETE /api/admin/tenants/[tenantId] - Delete tenant
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, hasRole, canAccessTenant } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface Params {
    params: { tenantId: string };
}

export async function GET(req: NextRequest, { params }: Params) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = params;

    if (!canAccessTenant(auth.user, tenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const db = getAdminDb();
        const doc = await db.collection('tenants').doc(tenantId).get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data()?.createdAt?.toDate?.()?.toISOString(),
            updatedAt: doc.data()?.updatedAt?.toDate?.()?.toISOString(),
        });

    } catch (error) {
        console.error('Get tenant error:', error);
        return NextResponse.json({ error: 'Failed to get tenant' }, { status: 500 });
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

    const { tenantId } = params;

    if (!canAccessTenant(auth.user, tenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { destination, channelId, notionWorkspaceId, defaultDatabaseId, settings } = body;

        const db = getAdminDb();
        const tenantRef = db.collection('tenants').doc(tenantId);

        const doc = await tenantRef.get();
        if (!doc.exists) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const updateData: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (destination !== undefined) updateData.destination = destination;
        if (channelId !== undefined) updateData.channelId = channelId;
        if (notionWorkspaceId !== undefined) updateData.notionWorkspaceId = notionWorkspaceId;
        if (defaultDatabaseId !== undefined) updateData.defaultDatabaseId = defaultDatabaseId;
        if (settings !== undefined) updateData.settings = { ...doc.data()?.settings, ...settings };

        await tenantRef.update(updateData);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Update tenant error:', error);
        return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owner can delete
    if (!hasRole(auth.user, ['owner'])) {
        return NextResponse.json({ error: 'Only owner can delete tenants' }, { status: 403 });
    }

    const { tenantId } = params;

    try {
        const db = getAdminDb();
        const tenantRef = db.collection('tenants').doc(tenantId);

        const doc = await tenantRef.get();
        if (!doc.exists) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // Delete tenant (subcollections remain - consider cleanup job)
        await tenantRef.delete();

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete tenant error:', error);
        return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 });
    }
}
