"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleCalendarAdapter = void 0;
exports.pullEvents = pullEvents;
exports.pushEvent = pushEvent;
exports.syncAllUsers = syncAllUsers;
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
// ================================
// Token Management
// ================================
async function getCalendarToken(userId) {
    const doc = await db.doc(`users/${userId}/integrations/google_calendar`).get();
    if (!doc.exists)
        return null;
    return doc.data();
}
async function refreshAccessToken(userId, token) {
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
    const data = await response.json();
    const newAccessToken = data.access_token;
    const expiresAt = Date.now() + (data.expires_in * 1000);
    // Save refreshed token
    await db.doc(`users/${userId}/integrations/google_calendar`).update({
        accessToken: newAccessToken,
        expiresAt,
    });
    return newAccessToken;
}
async function getValidAccessToken(userId) {
    const stored = await getCalendarToken(userId);
    if (!stored)
        throw new Error('Google Calendar not connected');
    let accessToken = stored.accessToken;
    if (Date.now() >= stored.expiresAt - 60_000) {
        accessToken = await refreshAccessToken(userId, stored);
    }
    return { token: accessToken, calendarId: stored.calendarId || 'primary' };
}
// ================================
// Pull: Google Calendar → Firestore
// ================================
async function pullEvents(userId, days = 14) {
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
    const data = await response.json();
    const events = data.items || [];
    const batch = db.batch();
    let count = 0;
    for (const event of events) {
        if (!event.id || event.status === 'cancelled')
            continue;
        const startDateTime = event.start.dateTime || event.start.date;
        if (!startDateTime)
            continue;
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
    if (count > 0)
        await batch.commit();
    v2_1.logger.info(`[GoogleCalendar] Synced ${count} events for user ${userId}`);
    return count;
}
// ================================
// Push: Firestore → Google Calendar
// ================================
async function pushEvent(userId, event) {
    const { token, calendarId } = await getValidAccessToken(userId);
    const gcalEvent = {
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
    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(gcalEvent),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Create event failed: ${response.status} - ${errText}`);
    }
    const created = await response.json();
    v2_1.logger.info(`[GoogleCalendar] Created event ${created.id} for user ${userId}`);
    return created.id;
}
// ================================
// Sync All Users (Cloud Scheduler)
// ================================
async function syncAllUsers() {
    const result = { synced: 0, errors: [] };
    const integrationsSnap = await db.collectionGroup('integrations').get();
    const userIds = new Set();
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
        }
        catch (err) {
            result.errors.push(`${uid}: ${err.message}`);
        }
    }
    return result;
}
exports.googleCalendarAdapter = {
    pullEvents,
    pushEvent,
    syncAllUsers,
    getCalendarToken,
};
//# sourceMappingURL=google-calendar.adapter.js.map