/**
 * Google Calendar Adapter
 * 
 * Two-way sync between Firestore calendar_events and Google Calendar.
 * 
 * Features:
 *   - Pull: Fetch events from Google Calendar → write to Firestore
 *   - Push: Write Firestore event → create in Google Calendar
 *   - OAuth2 token management via Firestore
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// ================================
// Types
// ================================

interface GoogleCalendarEvent {
    id?: string;
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    status?: string;
    recurrence?: string[];
}

interface CalendarToken {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    calendarId: string;
}

// ================================
// Token Management
// ================================

async function getCalendarToken(userId: string): Promise<CalendarToken | null> {
    const doc = await db.doc(`users/${userId}/integrations/google_calendar`).get();
    if (!doc.exists) return null;
    return doc.data() as CalendarToken;
}

async function refreshAccessToken(userId: string, token: CalendarToken): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret || !token.refreshToken) {
        throw new Error('Missing Google OAuth credentials');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: token.refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    const newAccessToken = data.access_token;
    const expiresAt = Date.now() + (data.expires_in * 1000);

    // Save refreshed token
    await db.doc(`users/${userId}/integrations/google_calendar`).update({
        accessToken: newAccessToken,
        expiresAt,
    });

    return newAccessToken;
}

async function getValidAccessToken(userId: string): Promise<{ token: string; calendarId: string }> {
    const stored = await getCalendarToken(userId);
    if (!stored) throw new Error('Google Calendar not connected');

    let accessToken = stored.accessToken;
    if (Date.now() >= stored.expiresAt - 60_000) {
        accessToken = await refreshAccessToken(userId, stored);
    }

    return { token: accessToken, calendarId: stored.calendarId || 'primary' };
}

// ================================
// Pull: Google Calendar → Firestore
// ================================

export async function pullEvents(userId: string, days: number = 14): Promise<number> {
    const { token, calendarId } = await getValidAccessToken(userId);

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 1);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + days);

    const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events` +
        `?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=100`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const data = await response.json() as { items?: GoogleCalendarEvent[] };
    const events: GoogleCalendarEvent[] = data.items || [];

    const batch = db.batch();
    let count = 0;

    for (const event of events) {
        if (!event.id || event.status === 'cancelled') continue;

        const startDateTime = event.start.dateTime || event.start.date;
        if (!startDateTime) continue;

        const date = startDateTime.split('T')[0];
        const docRef = db.doc(`users/${userId}/calendar_events/${event.id}`);

        batch.set(docRef, {
            title: event.summary || 'Untitled',
            description: event.description || '',
            location: event.location || '',
            date,
            startTime: event.start.dateTime
                ? new Date(event.start.dateTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
                : null,
            endTime: event.end.dateTime
                ? new Date(event.end.dateTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
                : null,
            allDay: !event.start.dateTime,
            source: 'google_calendar',
            googleEventId: event.id,
            syncedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });
        count++;
    }

    if (count > 0) await batch.commit();
    console.log(`[GoogleCalendar] Synced ${count} events for user ${userId}`);
    return count;
}

// ================================
// Push: Firestore → Google Calendar
// ================================

export async function pushEvent(
    userId: string,
    event: {
        title: string;
        start: Date;
        end: Date;
        location?: string;
        description?: string;
        allDay?: boolean;
    }
): Promise<string> {
    const { token, calendarId } = await getValidAccessToken(userId);

    const gcalEvent: GoogleCalendarEvent = {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: event.allDay
            ? { date: event.start.toISOString().split('T')[0] }
            : { dateTime: event.start.toISOString(), timeZone: 'Asia/Taipei' },
        end: event.allDay
            ? { date: event.end.toISOString().split('T')[0] }
            : { dateTime: event.end.toISOString(), timeZone: 'Asia/Taipei' },
    };

    const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(gcalEvent),
        }
    );

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Create event failed: ${response.status} - ${errText}`);
    }

    const created = await response.json() as { id: string };
    console.log(`[GoogleCalendar] Created event ${created.id} for user ${userId}`);
    return created.id;
}

// ================================
// Sync All Users (Cloud Scheduler)
// ================================

export async function syncAllUsers(): Promise<{ synced: number; errors: string[] }> {
    const result = { synced: 0, errors: [] as string[] };

    const integrationsSnap = await db.collectionGroup('integrations').get();
    const userIds = new Set<string>();

    for (const doc of integrationsSnap.docs) {
        if (doc.id === 'google_calendar' && doc.data().accessToken) {
            const pathParts = doc.ref.path.split('/');
            if (pathParts.length >= 2) {
                userIds.add(pathParts[1]);
            }
        }
    }

    for (const uid of userIds) {
        try {
            const count = await pullEvents(uid);
            result.synced += count;
        } catch (err) {
            result.errors.push(`${uid}: ${(err as Error).message}`);
        }
    }

    return result;
}

export const googleCalendarAdapter = {
    pullEvents,
    pushEvent,
    syncAllUsers,
    getCalendarToken,
};
