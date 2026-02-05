/**
 * Proactive Reminder Service
 *
 * Scheduled Cloud Function that sends proactive reminders:
 * - Vehicle maintenance alerts
 * - Bill payment reminders
 * - Health goals check-ins
 * - Event reminders
 *
 * Run via Cloud Scheduler every 15 minutes.
 */
/**
 * Main scheduled reminder processor
 */
export declare function processScheduledReminders(): Promise<{
    processed: number;
    sent: number;
    errors: string[];
}>;
/**
 * Cleanup old notification markers (run weekly)
 */
export declare function cleanupNotificationMarkers(): Promise<number>;
//# sourceMappingURL=proactive-reminders.service.d.ts.map