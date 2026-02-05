/**
 * Schedule Service
 *
 * Provides schedule and calendar management for the personal butler:
 * - Google Calendar integration
 * - Daily schedule overview
 * - Smart reminders
 * - Recurring event management
 * - Conflict detection
 */
import * as admin from 'firebase-admin';
export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    start: Date | string;
    end: Date | string;
    allDay: boolean;
    location?: string;
    category: EventCategory;
    recurrence?: RecurrenceRule;
    reminders: Reminder[];
    source: 'google' | 'manual' | 'line' | 'notion';
    externalId?: string;
    createdAt: admin.firestore.Timestamp;
    updatedAt: admin.firestore.Timestamp;
}
export type EventCategory = 'work' | 'personal' | 'health' | 'finance' | 'vehicle' | 'business' | 'social' | 'holiday' | 'other';
export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endDate?: string;
    count?: number;
}
export interface Reminder {
    type: 'notification' | 'line' | 'telegram' | 'email';
    minutesBefore: number;
    sent?: boolean;
}
export interface DailySchedule {
    date: string;
    events: CalendarEvent[];
    summary: {
        totalEvents: number;
        workEvents: number;
        personalEvents: number;
        freeSlots: TimeSlot[];
    };
}
export interface TimeSlot {
    start: string;
    end: string;
    duration: number;
}
export declare class ScheduleService {
    /**
     * Add a calendar event
     */
    addEvent(uid: string, event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarEvent>;
    /**
     * Get event by ID
     */
    getEvent(uid: string, eventId: string): Promise<CalendarEvent | null>;
    /**
     * Get events for a date range
     */
    getEvents(uid: string, startDate: string, endDate: string): Promise<CalendarEvent[]>;
    /**
     * Get today's schedule
     */
    getTodaySchedule(uid: string): Promise<DailySchedule>;
    /**
     * Get daily schedule with summary
     */
    getDailySchedule(uid: string, date: string): Promise<DailySchedule>;
    /**
     * Calculate free time slots
     */
    private calculateFreeSlots;
    /**
     * Check for scheduling conflicts
     */
    checkConflicts(uid: string, newEvent: {
        start: Date | string;
        end: Date | string;
    }): Promise<CalendarEvent[]>;
    /**
     * Get upcoming reminders
     */
    getUpcomingReminders(uid: string, minutesAhead?: number): Promise<ReminderNotification[]>;
    /**
     * Add quick event from natural language
     */
    parseQuickEvent(text: string): Partial<CalendarEvent>;
    /**
     * Get week overview
     */
    getWeekOverview(uid: string): Promise<WeekOverview>;
    private timeToMinutes;
    private dateToTimeString;
}
export interface ReminderNotification {
    eventId: string;
    eventTitle: string;
    eventStart: string;
    reminderType: string;
    reminderTime: string;
    minutesBefore: number;
}
export interface WeekOverview {
    weekStart: string;
    days: DailySchedule[];
    summary: {
        totalEvents: number;
        busiestDay: string;
        busiestDayCount: number;
    };
}
export declare const scheduleService: ScheduleService;
//# sourceMappingURL=schedule.service.d.ts.map