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

import * as admin from 'firebase-admin';
import { 
    notificationService, 
    NotificationTemplates,
} from './notification.service';
import { vehicleService } from './vehicle.service';
import { financeService } from './finance.service';
import { scheduleService } from './schedule.service';

const db = admin.firestore();

/**
 * Main scheduled reminder processor
 */
export async function processScheduledReminders(): Promise<{
    processed: number;
    sent: number;
    errors: string[];
}> {
    const result = { processed: 0, sent: 0, errors: [] as string[] };

    try {
        // Get all users with Butler enabled
        const usersSnapshot = await db.collectionGroup('profile')
            .where('butlerEnabled', '==', true)
            .limit(100)
            .get();

        for (const doc of usersSnapshot.docs) {
            const pathParts = doc.ref.path.split('/');
            const uid = pathParts[1];

            try {
                await processUserReminders(uid, result);
            } catch (error) {
                result.errors.push(`User ${uid}: ${(error as Error).message}`);
            }
        }

        console.log(`[Reminders] Processed: ${result.processed}, Sent: ${result.sent}`);
        return result;
    } catch (error) {
        result.errors.push((error as Error).message);
        return result;
    }
}

/**
 * Process reminders for a single user
 */
async function processUserReminders(
    uid: string,
    result: { processed: number; sent: number; errors: string[] }
): Promise<void> {
    // 1. Check vehicle maintenance
    await checkVehicleReminders(uid, result);

    // 2. Check upcoming bills
    await checkBillReminders(uid, result);

    // 3. Check upcoming events
    await checkEventReminders(uid, result);

    // 4. Check daily health reminder
    await checkHealthReminders(uid, result);
}

/**
 * Vehicle maintenance reminders
 */
async function checkVehicleReminders(
    uid: string,
    result: { processed: number; sent: number; errors: string[] }
): Promise<void> {
    result.processed++;

    try {
        // Get user's vehicles
        const vehiclesRef = db.collection(`users/${uid}/butler/vehicles`);
        const snapshot = await vehiclesRef.get();

        for (const doc of snapshot.docs) {
            const vehicleId = doc.id;
            const reminders = await vehicleService.getMaintenanceSchedule(uid, vehicleId);

            // Check for upcoming maintenance
            for (const item of reminders) {
                if (item.daysUntil !== undefined && item.daysUntil <= 7) {
                    // Check if already notified today
                    const notifiedKey = `vehicle_${vehicleId}_${item.type}_${new Date().toISOString().split('T')[0]}`;
                    const alreadyNotified = await checkNotified(uid, notifiedKey);
                    
                    if (!alreadyNotified) {
                        const template = NotificationTemplates.maintenanceReminder(
                            item.type,
                            `預計 ${item.daysUntil} 天後到期`
                        );

                        const notifResult = await notificationService.send({
                            userId: uid,
                            channel: 'line',
                            title: template.title,
                            message: template.message,
                            category: 'vehicle',
                        });

                        if (notifResult.sent) {
                            result.sent++;
                            await markNotified(uid, notifiedKey);
                        }
                    }
                }
            }
        }
    } catch (error) {
        result.errors.push(`Vehicle reminder for ${uid}: ${(error as Error).message}`);
    }
}

/**
 * Bill payment reminders
 */
async function checkBillReminders(
    uid: string,
    result: { processed: number; sent: number; errors: string[] }
): Promise<void> {
    result.processed++;

    try {
        const bills = await financeService.getUpcomingBills(uid, 7);

        for (const bill of bills) {
            const notifiedKey = `bill_${bill.name}_${bill.dueDay}`;
            const alreadyNotified = await checkNotified(uid, notifiedKey);

            if (!alreadyNotified) {
                const template = NotificationTemplates.billReminder(
                    bill.name,
                    bill.daysUntil,
                    bill.amount
                );

                const notifResult = await notificationService.send({
                    userId: uid,
                    channel: 'line',
                    title: template.title,
                    message: template.message,
                    category: 'finance',
                });

                if (notifResult.sent) {
                    result.sent++;
                    await markNotified(uid, notifiedKey);
                }
            }
        }
    } catch (error) {
        result.errors.push(`Bill reminder for ${uid}: ${(error as Error).message}`);
    }
}

/**
 * Event reminders (30 minutes before)
 */
async function checkEventReminders(
    uid: string,
    result: { processed: number; sent: number; errors: string[] }
): Promise<void> {
    result.processed++;

    try {
        const reminders = await scheduleService.getUpcomingReminders(uid, 30);

        for (const event of reminders) {
            const notifiedKey = `event_${event.eventId}_30min`;
            const alreadyNotified = await checkNotified(uid, notifiedKey);

            if (!alreadyNotified) {
                const template = NotificationTemplates.eventReminder(
                    event.eventTitle,
                    event.eventStart,
                    30
                );

                const notifResult = await notificationService.send({
                    userId: uid,
                    channel: 'line',
                    title: template.title,
                    message: template.message,
                    category: 'schedule',
                });

                if (notifResult.sent) {
                    result.sent++;
                    await markNotified(uid, notifiedKey);
                }
            }
        }
    } catch (error) {
        result.errors.push(`Event reminder for ${uid}: ${(error as Error).message}`);
    }
}

/**
 * Daily health reminder (morning check-in)
 */
async function checkHealthReminders(
    uid: string,
    result: { processed: number; sent: number; errors: string[] }
): Promise<void> {
    result.processed++;

    try {
        const now = new Date();
        const hour = now.getHours();

        // Only send morning reminder between 7-9 AM
        if (hour < 7 || hour >= 9) return;

        const today = now.toISOString().split('T')[0];
        const notifiedKey = `health_daily_${today}`;
        const alreadyNotified = await checkNotified(uid, notifiedKey);

        if (!alreadyNotified) {
            // Get user profile for name
            const profileDoc = await db.doc(`users/${uid}/butler/profile`).get();
            const profile = profileDoc.data();
            const name = profile?.userProfile?.name || '您';

            const template = NotificationTemplates.exerciseReminder(name);

            const notifResult = await notificationService.send({
                userId: uid,
                channel: 'line',
                title: template.title,
                message: template.message,
                category: 'health',
            });

            if (notifResult.sent) {
                result.sent++;
                await markNotified(uid, notifiedKey);
            }
        }
    } catch (error) {
        result.errors.push(`Health reminder for ${uid}: ${(error as Error).message}`);
    }
}

/**
 * Check if already notified today
 */
async function checkNotified(uid: string, key: string): Promise<boolean> {
    const doc = await db.doc(`users/${uid}/butler/notifications/sent/${key}`).get();
    return doc.exists;
}

/**
 * Mark as notified
 */
async function markNotified(uid: string, key: string): Promise<void> {
    await db.doc(`users/${uid}/butler/notifications/sent/${key}`).set({
        timestamp: admin.firestore.Timestamp.now(),
    });
}

/**
 * Cleanup old notification markers (run weekly)
 */
export async function cleanupNotificationMarkers(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoff);

    const markerGroups = await db.collectionGroup('sent')
        .where('timestamp', '<', cutoffTimestamp)
        .limit(500)
        .get();

    const batch = db.batch();
    markerGroups.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return markerGroups.size;
}
