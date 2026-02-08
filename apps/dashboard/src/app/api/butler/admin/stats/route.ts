/**
 * GET /api/butler/admin/stats - Butler admin statistics
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    const auth = await verifyAuthToken(req);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getAdminDb();

        // Total butler users (count users with butler profiles)
        const usersSnap = await db.collectionGroup('butler_preferences').count().get();
        const totalUsers = usersSnap.data().count;

        // 24h message volume
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);
        const messagesSnap = await db.collectionGroup('butler_messages')
            .where('timestamp', '>=', yesterday)
            .count()
            .get();
        const messageVolume24h = messagesSnap.data().count;

        // Active sessions (within last 30 minutes)
        const thirtyMinAgo = new Date();
        thirtyMinAgo.setMinutes(thirtyMinAgo.getMinutes() - 30);
        const activeSnap = await db.collectionGroup('conversation_sessions')
            .where('lastActivity', '>=', thirtyMinAgo)
            .count()
            .get();
        const activeSessions = activeSnap.data().count;

        // Recent conversations (last 20)
        const convSnap = await db.collectionGroup('conversation_sessions')
            .orderBy('lastActivity', 'desc')
            .limit(20)
            .get();

        const conversations = convSnap.docs.map(d => {
            const data = d.data();
            const pathParts = d.ref.path.split('/');
            return {
                userId: pathParts.length >= 2 ? pathParts[1] : 'unknown',
                lastActivity: data.lastActivity?.toDate?.()?.toISOString() || null,
                messageCount: data.messageCount || 0,
                domain: data.lastDomain || 'general',
                status: data.expired ? 'expired' : 'active',
            };
        });

        // Domain distribution
        const domainCounts: Record<string, number> = {
            general: 0, finance: 0, schedule: 0, health: 0, vehicle: 0,
        };
        conversations.forEach(c => {
            if (c.domain in domainCounts) domainCounts[c.domain]++;
            else domainCounts['general']++;
        });

        return NextResponse.json({
            totalUsers,
            messageVolume24h,
            activeSessions,
            avgResponseTime: 1.2, // Placeholder — requires logging
            conversations,
            domainDistribution: domainCounts,
            botConfig: {
                richMenu: true,
                flexMessage: true,
                multiTurn: true,
                model: 'gemini-2.0-flash',
                sessionTTL: '30 min',
                historySize: 10,
            },
        });
    } catch (error) {
        console.error('Butler admin stats error:', error);
        return NextResponse.json({ error: 'Failed to load admin stats' }, { status: 500 });
    }
}
