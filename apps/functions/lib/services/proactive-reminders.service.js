"use strict";
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
exports.processScheduledReminders = processScheduledReminders;
exports.cleanupNotificationMarkers = cleanupNotificationMarkers;
const admin = __importStar(require("firebase-admin"));
const notification_service_1 = require("./notification.service");
const vehicle_service_1 = require("./vehicle.service");
const finance_service_1 = require("./finance.service");
const schedule_service_1 = require("./schedule.service");
const db = admin.firestore();
/**
 * Main scheduled reminder processor
 */
async function processScheduledReminders() {
    const result = { processed: 0, sent: 0, errors: [] };
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
            }
            catch (error) {
                result.errors.push(`User ${uid}: ${error.message}`);
            }
        }
        console.log(`[Reminders] Processed: ${result.processed}, Sent: ${result.sent}`);
        return result;
    }
    catch (error) {
        result.errors.push(error.message);
        return result;
    }
}
/**
 * Process reminders for a single user
 */
async function processUserReminders(uid, result) {
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
async function checkVehicleReminders(uid, result) {
    result.processed++;
    try {
        // Get user's vehicles
        const vehiclesRef = db.collection(`users/${uid}/butler/vehicles`);
        const snapshot = await vehiclesRef.get();
        for (const doc of snapshot.docs) {
            const vehicleId = doc.id;
            const reminders = await vehicle_service_1.vehicleService.getMaintenanceSchedule(uid, vehicleId);
            // Check for upcoming maintenance
            for (const item of reminders) {
                if (item.daysUntil !== undefined && item.daysUntil <= 7) {
                    // Check if already notified today
                    const notifiedKey = `vehicle_${vehicleId}_${item.type}_${new Date().toISOString().split('T')[0]}`;
                    const alreadyNotified = await checkNotified(uid, notifiedKey);
                    if (!alreadyNotified) {
                        const template = notification_service_1.NotificationTemplates.maintenanceReminder(item.type, `預計 ${item.daysUntil} 天後到期`);
                        const notifResult = await notification_service_1.notificationService.send({
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
    }
    catch (error) {
        result.errors.push(`Vehicle reminder for ${uid}: ${error.message}`);
    }
}
/**
 * Bill payment reminders
 */
async function checkBillReminders(uid, result) {
    result.processed++;
    try {
        const bills = await finance_service_1.financeService.getUpcomingBills(uid, 7);
        for (const bill of bills) {
            const notifiedKey = `bill_${bill.name}_${bill.dueDay}`;
            const alreadyNotified = await checkNotified(uid, notifiedKey);
            if (!alreadyNotified) {
                const template = notification_service_1.NotificationTemplates.billReminder(bill.name, bill.daysUntil, bill.amount);
                const notifResult = await notification_service_1.notificationService.send({
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
    }
    catch (error) {
        result.errors.push(`Bill reminder for ${uid}: ${error.message}`);
    }
}
/**
 * Event reminders (30 minutes before)
 */
async function checkEventReminders(uid, result) {
    result.processed++;
    try {
        const reminders = await schedule_service_1.scheduleService.getUpcomingReminders(uid, 30);
        for (const event of reminders) {
            const notifiedKey = `event_${event.eventId}_30min`;
            const alreadyNotified = await checkNotified(uid, notifiedKey);
            if (!alreadyNotified) {
                const template = notification_service_1.NotificationTemplates.eventReminder(event.eventTitle, event.eventStart, 30);
                const notifResult = await notification_service_1.notificationService.send({
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
    }
    catch (error) {
        result.errors.push(`Event reminder for ${uid}: ${error.message}`);
    }
}
/**
 * Daily health reminder (morning check-in)
 */
async function checkHealthReminders(uid, result) {
    result.processed++;
    try {
        const now = new Date();
        const hour = now.getHours();
        // Only send morning reminder between 7-9 AM
        if (hour < 7 || hour >= 9)
            return;
        const today = now.toISOString().split('T')[0];
        const notifiedKey = `health_daily_${today}`;
        const alreadyNotified = await checkNotified(uid, notifiedKey);
        if (!alreadyNotified) {
            // Get user profile for name
            const profileDoc = await db.doc(`users/${uid}/butler/profile`).get();
            const profile = profileDoc.data();
            const name = profile?.userProfile?.name || '您';
            const template = notification_service_1.NotificationTemplates.exerciseReminder(name);
            const notifResult = await notification_service_1.notificationService.send({
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
    }
    catch (error) {
        result.errors.push(`Health reminder for ${uid}: ${error.message}`);
    }
}
/**
 * Check if already notified today
 */
async function checkNotified(uid, key) {
    const doc = await db.doc(`users/${uid}/butler/notifications/sent/${key}`).get();
    return doc.exists;
}
/**
 * Mark as notified
 */
async function markNotified(uid, key) {
    await db.doc(`users/${uid}/butler/notifications/sent/${key}`).set({
        timestamp: admin.firestore.Timestamp.now(),
    });
}
/**
 * Cleanup old notification markers (run weekly)
 */
async function cleanupNotificationMarkers() {
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
//# sourceMappingURL=proactive-reminders.service.js.map