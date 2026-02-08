/**
 * GET /api/butler/schedule - Today's + this week's events
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

        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // This week (Mon-Sun)
        const dayOfWeek = now.getDay();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        // Today's events
        const todaySnap = await db.collection(`users/${uid}/calendar_events`)
            .where('date', '==', today)
            .orderBy('startTime', 'asc')
            .get();

        const todayEvents = todaySnap.docs.map(d => ({
            id: d.id,
            title: d.data().title,
            startTime: d.data().startTime,
            endTime: d.data().endTime,
            location: d.data().location,
            category: d.data().category,
            allDay: d.data().allDay || false,
        }));

        // This week's events
        const weekSnap = await db.collection(`users/${uid}/calendar_events`)
            .where('date', '>=', weekStartStr)
            .where('date', '<=', weekEndStr)
            .orderBy('date', 'asc')
            .get();

        const weekEvents = weekSnap.docs.map(d => ({
            id: d.id,
            title: d.data().title,
            date: d.data().date,
            startTime: d.data().startTime,
            endTime: d.data().endTime,
            location: d.data().location,
            category: d.data().category,
        }));

        // Upcoming reminders
        const remSnap = await db.collection(`users/${uid}/butler/reminders`)
            .where('completed', '==', false)
            .orderBy('dueDate', 'asc')
            .limit(5)
            .get();

        const reminders = remSnap.docs.map(d => ({
            id: d.id,
            title: d.data().title,
            dueDate: d.data().dueDate,
        }));

        return NextResponse.json({
            today: {
                date: today,
                dayLabel: now.toLocaleDateString('zh-TW', { weekday: 'long', month: 'long', day: 'numeric' }),
                events: todayEvents,
            },
            week: {
                startDate: weekStartStr,
                endDate: weekEndStr,
                events: weekEvents,
                totalCount: weekEvents.length,
            },
            reminders,
        });
    } catch (error) {
        console.error('Butler schedule error:', error);
        return NextResponse.json({ error: 'Failed to load schedule data' }, { status: 500 });
    }
}
