import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/social/notifications
 * List all notification settings
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();
        const snapshot = await db.collection('social_notifications')
            .orderBy('createdAt', 'desc')
            .get();

        const notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
        }));

        return NextResponse.json({ notifications });

    } catch (error) {
        console.error('Notifications GET error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/admin/social/notifications
 * Create a new notification setting
 */
export async function POST(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        if (authResult.role === 'viewer') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { channel, name, config, minSeverity, minUrgency, enabled } = body;

        if (!channel || !name) {
            return NextResponse.json({ error: 'Channel and name are required' }, { status: 400 });
        }

        const db = getFirestore();
        const docRef = await db.collection('social_notifications').add({
            channel,
            name,
            config: config || {},
            minSeverity: minSeverity || 50,
            minUrgency: minUrgency || 5,
            enabled: enabled !== false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ id: docRef.id, success: true });

    } catch (error) {
        console.error('Notifications POST error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
