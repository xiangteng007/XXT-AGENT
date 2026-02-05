/**
 * GET /api/admin/mappings - List mappings for a tenant
 * POST /api/admin/mappings - Create new mapping
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, hasRole, canAccessTenant } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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
        const mappingsRef = db.collection('tenants').doc(tenantId).collection('mappings');
        const snapshot = await mappingsRef.get();

        const mappings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
        }));

        return NextResponse.json({ mappings });

    } catch (error) {
        console.error('List mappings error:', error);
        return NextResponse.json({ error: 'Failed to list mappings' }, { status: 500 });
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
        const { tenantId, databaseId, fields, defaults } = body;

        if (!tenantId || !databaseId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!canAccessTenant(auth.user, tenantId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const db = getAdminDb();
        const mappingsRef = db.collection('tenants').doc(tenantId).collection('mappings');

        const mappingData = {
            databaseId,
            fields: fields || {
                title: 'Name',
                content: '',
                tags: 'Tags',
                date: 'Date',
                files: 'Attachments',
                location: '',
            },
            defaults: defaults || {},
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        const docRef = await mappingsRef.add(mappingData);

        return NextResponse.json({
            id: docRef.id,
            ...mappingData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, { status: 201 });

    } catch (error) {
        console.error('Create mapping error:', error);
        return NextResponse.json({ error: 'Failed to create mapping' }, { status: 500 });
    }
}
