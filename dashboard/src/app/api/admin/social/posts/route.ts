import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/social/posts
 * List social posts with filters
 */
export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyAuth(req);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const db = getFirestore();
        const searchParams = req.nextUrl.searchParams;

        // Build query
        let query: FirebaseFirestore.Query = db.collection('social_posts');

        const platform = searchParams.get('platform');
        if (platform && platform !== 'all') {
            query = query.where('platform', '==', platform);
        }

        const sentiment = searchParams.get('sentiment');
        if (sentiment && sentiment !== 'all') {
            query = query.where('sentiment', '==', sentiment);
        }

        const minUrgency = searchParams.get('minUrgency');
        if (minUrgency) {
            query = query.where('urgency', '>=', Number(minUrgency));
        }

        const keyword = searchParams.get('keyword');
        if (keyword) {
            query = query.where('keywords', 'array-contains', keyword);
        }

        const location = searchParams.get('location');
        if (location) {
            query = query.where('location', '==', location);
        }

        // Order and limit
        query = query.orderBy('createdAt', 'desc').limit(100);

        const snapshot = await query.get();
        const posts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        }));

        return NextResponse.json({ posts });

    } catch (error) {
        console.error('Social posts API error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
