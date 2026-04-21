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
interface CalendarToken {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    calendarId: string;
}
declare function getCalendarToken(userId: string): Promise<CalendarToken | null>;
export declare function pullEvents(userId: string, days?: number): Promise<number>;
export declare function pushEvent(userId: string, event: {
    title: string;
    start: Date;
    end: Date;
    location?: string;
    description?: string;
    allDay?: boolean;
}): Promise<string>;
export declare function syncAllUsers(): Promise<{
    synced: number;
    errors: string[];
}>;
export declare const googleCalendarAdapter: {
    pullEvents: typeof pullEvents;
    pushEvent: typeof pushEvent;
    syncAllUsers: typeof syncAllUsers;
    getCalendarToken: typeof getCalendarToken;
};
export {};
//# sourceMappingURL=google-calendar.adapter.d.ts.map