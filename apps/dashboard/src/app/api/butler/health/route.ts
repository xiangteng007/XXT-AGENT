/**
 * GET /api/butler/health - Today's health data + 7-day trend
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
        const uid = auth.user.uid;

        // Today's health
        const today = new Date().toISOString().split('T')[0];
        const todaySnap = await db.collection(`users/${uid}/health_logs`)
            .where('date', '==', today)
            .limit(1)
            .get();

        const todayData = todaySnap.empty ? null : todaySnap.docs[0].data();

        // 7-day trend
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStr = weekAgo.toISOString().split('T')[0];

        const trendSnap = await db.collection(`users/${uid}/health_logs`)
            .where('date', '>=', weekStr)
            .orderBy('date', 'desc')
            .limit(7)
            .get();

        const trend = trendSnap.docs.map(d => ({
            date: d.data().date,
            steps: d.data().steps || 0,
            calories: d.data().caloriesBurned || 0,
            sleepHours: d.data().sleepHours || 0,
            activeMinutes: d.data().activeMinutes || 0,
        }));

        // Latest weight
        const weightSnap = await db.collection(`users/${uid}/weight_logs`)
            .orderBy('date', 'desc')
            .limit(7)
            .get();

        const weights = weightSnap.docs.map(d => ({
            date: d.data().date,
            weight: d.data().weight,
        }));

        return NextResponse.json({
            today: todayData ? {
                steps: todayData.steps || 0,
                stepsGoal: 8000,
                activeMinutes: todayData.activeMinutes || 0,
                calories: todayData.caloriesBurned || 0,
                sleepHours: todayData.sleepHours || 0,
            } : null,
            trend,
            weights,
        });
    } catch (error) {
        console.error('Butler health error:', error);
        return NextResponse.json({ error: 'Failed to load health data' }, { status: 500 });
    }
}
