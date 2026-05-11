/**
 * PUT /api/guardian/policies/[id] - Update a policy
 * DELETE /api/guardian/policies/[id] - Delete a policy
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyAuthToken(req);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const uid = auth.user.uid;
        const { id } = await params;
        const body = await req.json();

        const docRef = db.collection(`users/${uid}/policies`).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
        }

        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        const allowedFields = ['policy_name', 'insurer', 'status', 'ledger_linked', 'annual_premium', 'currency', 'coverage_start', 'coverage_end'];
        
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        await docRef.update(updateData);

        return NextResponse.json({ message: 'Policy updated successfully' });
    } catch (error) {
        console.error('Guardian PUT error:', error);
        return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyAuthToken(req);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const uid = auth.user.uid;
        const { id } = await params;

        const docRef = db.collection(`users/${uid}/policies`).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
        }

        await docRef.delete();

        return NextResponse.json({ message: 'Policy deleted successfully' });
    } catch (error) {
        console.error('Guardian DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete policy' }, { status: 500 });
    }
}
