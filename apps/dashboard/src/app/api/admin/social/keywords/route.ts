import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/social/keywords
 * List all keywords
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();
        const snapshot = await db.collection('social_keywords')
            .orderBy('createdAt', 'desc')
            .get();

        const keywords = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
        }));

        return NextResponse.json({ keywords });

    } catch (error) {
        console.error('Keywords GET error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/admin/social/keywords
 * Create a new keyword
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
        const { keyword, priority, enabled, platforms } = body;

        if (!keyword) {
            return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
        }

        const db = getFirestore();
        const docRef = await db.collection('social_keywords').add({
            keyword: keyword.trim(),
            priority: priority || 'medium',
            enabled: enabled !== false,
            platforms: platforms || ['all'],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ id: docRef.id, success: true });

    } catch (error) {
        console.error('Keywords POST error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
