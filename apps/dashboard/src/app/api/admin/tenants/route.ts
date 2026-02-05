/**
 * GET /api/admin/tenants - List all tenants
 * POST /api/admin/tenants - Create new tenant
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, hasRole, AdminUser } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(req: NextRequest) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const tenantsRef = db.collection('tenants');

        let query = tenantsRef.orderBy('createdAt', 'desc');

        // Filter by allowed tenants if not owner/admin with full access
        if (auth.user.allowTenants.length > 0) {
            query = tenantsRef.where('__name__', 'in', auth.user.allowTenants);
        }

        const snapshot = await query.get();
        const tenants = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
        }));

        return NextResponse.json({ tenants });

    } catch (error) {
        console.error('List tenants error:', error);
        return NextResponse.json({ error: 'Failed to list tenants' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin/owner can create
    if (!hasRole(auth.user, ['owner', 'admin'])) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { id, destination, channelId, notionWorkspaceId, defaultDatabaseId, timezone, retentionDays } = body;

        if (!id || !destination) {
            return NextResponse.json({ error: 'Missing required fields: id, destination' }, { status: 400 });
        }

        const db = getAdminDb();
        const tenantRef = db.collection('tenants').doc(id);

        // Check if exists
        const existing = await tenantRef.get();
        if (existing.exists) {
            return NextResponse.json({ error: 'Tenant already exists' }, { status: 409 });
        }

        const tenantData = {
            destination,
            channelId: channelId || destination,
            notionWorkspaceId: notionWorkspaceId || '',
            defaultDatabaseId: defaultDatabaseId || '',
            settings: {
                timezone: timezone || 'Asia/Taipei',
                retentionDays: retentionDays || 30,
                enabled: true,
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await tenantRef.set(tenantData);

        return NextResponse.json({
            id,
            ...tenantData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, { status: 201 });

    } catch (error) {
        console.error('Create tenant error:', error);
        return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
    }
}
