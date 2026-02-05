"use strict";
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
exports.scheduleService = exports.ScheduleService = void 0;
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// ================================
// Schedule Service Class
// ================================
class ScheduleService {
    /**
     * Add a calendar event
     */
    async addEvent(uid, event) {
        const id = `event_${Date.now()}`;
        const newEvent = {
            id,
            ...event,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        };
        await db.doc(`users/${uid}/butler/schedule/events/${id}`).set(newEvent);
        return newEvent;
    }
    /**
     * Get event by ID
     */
    async getEvent(uid, eventId) {
        const doc = await db.doc(`users/${uid}/butler/schedule/events/${eventId}`).get();
        if (!doc.exists)
            return null;
        return doc.data();
    }
    /**
     * Get events for a date range
     */
    async getEvents(uid, startDate, endDate) {
        const snapshot = await db
            .collection(`users/${uid}/butler/schedule/events`)
            .where('start', '>=', startDate)
            .where('start', '<=', endDate + 'T23:59:59')
            .orderBy('start', 'asc')
            .get();
        return snapshot.docs.map(doc => doc.data());
    }
    /**
     * Get today's schedule
     */
    async getTodaySchedule(uid) {
        const today = new Date().toISOString().split('T')[0];
        return this.getDailySchedule(uid, today);
    }
    /**
     * Get daily schedule with summary
     */
    async getDailySchedule(uid, date) {
        const events = await this.getEvents(uid, date, date);
        const workEvents = events.filter(e => e.category === 'work' || e.category === 'business');
        const personalEvents = events.filter(e => e.category === 'personal' || e.category === 'social');
        // Calculate free time slots (between 9am and 6pm)
        const freeSlots = this.calculateFreeSlots(events, '09:00', '18:00');
        return {
            date,
            events,
            summary: {
                totalEvents: events.length,
                workEvents: workEvents.length,
                personalEvents: personalEvents.length,
                freeSlots,
            },
        };
    }
    /**
     * Calculate free time slots
     */
    calculateFreeSlots(events, dayStart, dayEnd) {
        const slots = [];
        // Filter non-all-day events and sort by start time
        const timedEvents = events
            .filter(e => !e.allDay)
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        if (timedEvents.length === 0) {
            const startMinutes = this.timeToMinutes(dayStart);
            const endMinutes = this.timeToMinutes(dayEnd);
            slots.push({
                start: dayStart,
                end: dayEnd,
                duration: endMinutes - startMinutes,
            });
            return slots;
        }
        let currentTime = dayStart;
        for (const event of timedEvents) {
            const eventStart = this.dateToTimeString(new Date(event.start));
            const eventEnd = this.dateToTimeString(new Date(event.end));
            if (currentTime < eventStart) {
                const duration = this.timeToMinutes(eventStart) - this.timeToMinutes(currentTime);
                if (duration >= 30) { // Only show slots >= 30 min
                    slots.push({
                        start: currentTime,
                        end: eventStart,
                        duration,
                    });
                }
            }
            if (eventEnd > currentTime) {
                currentTime = eventEnd;
            }
        }
        // Check for free time after last event
        if (currentTime < dayEnd) {
            const duration = this.timeToMinutes(dayEnd) - this.timeToMinutes(currentTime);
            if (duration >= 30) {
                slots.push({
                    start: currentTime,
                    end: dayEnd,
                    duration,
                });
            }
        }
        return slots;
    }
    /**
     * Check for scheduling conflicts
     */
    async checkConflicts(uid, newEvent) {
        const startDate = new Date(newEvent.start).toISOString().split('T')[0];
        const endDate = new Date(newEvent.end).toISOString().split('T')[0];
        const events = await this.getEvents(uid, startDate, endDate);
        const newStart = new Date(newEvent.start).getTime();
        const newEnd = new Date(newEvent.end).getTime();
        return events.filter(event => {
            const eventStart = new Date(event.start).getTime();
            const eventEnd = new Date(event.end).getTime();
            // Check for overlap
            return (newStart < eventEnd && newEnd > eventStart);
        });
    }
    /**
     * Get upcoming reminders
     */
    async getUpcomingReminders(uid, minutesAhead = 60) {
        const now = new Date();
        const future = new Date(now.getTime() + minutesAhead * 60 * 1000);
        const events = await this.getEvents(uid, now.toISOString().split('T')[0], future.toISOString().split('T')[0]);
        const notifications = [];
        for (const event of events) {
            const eventStart = new Date(event.start).getTime();
            for (const reminder of event.reminders || []) {
                if (reminder.sent)
                    continue;
                const reminderTime = eventStart - reminder.minutesBefore * 60 * 1000;
                if (reminderTime >= now.getTime() && reminderTime <= future.getTime()) {
                    notifications.push({
                        eventId: event.id,
                        eventTitle: event.title,
                        eventStart: event.start,
                        reminderType: reminder.type,
                        reminderTime: new Date(reminderTime).toISOString(),
                        minutesBefore: reminder.minutesBefore,
                    });
                }
            }
        }
        return notifications.sort((a, b) => new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime());
    }
    /**
     * Add quick event from natural language
     */
    parseQuickEvent(text) {
        const result = {
            title: text,
            category: 'other',
            allDay: false,
            reminders: [{ type: 'notification', minutesBefore: 30 }],
            source: 'manual',
        };
        // Extract time patterns
        const timePatterns = [
            { regex: /(\d{1,2})[:\s]?(\d{2})?\s*(am|pm)/i, format: '12h' },
            { regex: /(\d{1,2}):(\d{2})/i, format: '24h' },
        ];
        for (const pattern of timePatterns) {
            const match = text.match(pattern.regex);
            if (match) {
                let hour = parseInt(match[1]);
                const minute = parseInt(match[2] || '0');
                if (pattern.format === '12h' && match[3]?.toLowerCase() === 'pm' && hour < 12) {
                    hour += 12;
                }
                const today = new Date();
                today.setHours(hour, minute, 0, 0);
                result.start = today;
                result.end = new Date(today.getTime() + 60 * 60 * 1000); // 1 hour default
                // Remove time from title
                result.title = text.replace(pattern.regex, '').trim();
                break;
            }
        }
        // Detect category from keywords
        const categoryKeywords = {
            work: ['會議', '開會', 'meeting', '工作'],
            personal: ['個人', '私人'],
            health: ['運動', '健身', 'gym', '看醫生', '健檢'],
            finance: ['繳費', '銀行', '轉帳', '保險'],
            vehicle: ['保養', '加油', '洗車', '驗車'],
            business: ['公司', '客戶', '專案'],
            social: ['聚餐', '見面', '約'],
            holiday: ['休假', '放假'],
            other: [],
        };
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(k => text.includes(k))) {
                result.category = category;
                break;
            }
        }
        return result;
    }
    /**
     * Get week overview
     */
    async getWeekOverview(uid) {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Start from Sunday
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            days.push(await this.getDailySchedule(uid, dateStr));
        }
        const totalEvents = days.reduce((sum, d) => sum + d.summary.totalEvents, 0);
        const busiestDay = days.reduce((max, d) => d.summary.totalEvents > max.summary.totalEvents ? d : max);
        return {
            weekStart: weekStart.toISOString().split('T')[0],
            days,
            summary: {
                totalEvents,
                busiestDay: busiestDay.date,
                busiestDayCount: busiestDay.summary.totalEvents,
            },
        };
    }
    // ================================
    // Helper Methods
    // ================================
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }
    dateToTimeString(date) {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
}
exports.ScheduleService = ScheduleService;
exports.scheduleService = new ScheduleService();
//# sourceMappingURL=schedule.service.js.map