/**
 * Butler Data Service
 * 
 * Aggregates user personal data from Firestore subcollections
 * to enrich AI context for personalized responses.
 * 
 * Collections layout:
 *   users/{userId}/health_records
 *   users/{userId}/finance_transactions
 *   users/{userId}/vehicle_records
 *   users/{userId}/calendar_events
 *   users/{userId}/butler_preferences
 */

import * as admin from 'firebase-admin';

const db = admin.firestore();

export interface ButlerContext {
    health?: HealthSummary;
    finance?: FinanceSummary;
    vehicle?: VehicleSummary;
    calendar?: CalendarSummary;
    preferences?: UserPreferences;
}

interface HealthSummary {
    latestWeight?: number;
    latestSteps?: number;
    latestSleepHours?: number;
    weeklyExerciseMinutes?: number;
    lastUpdated?: string;
}

interface FinanceSummary {
    monthlySpending?: number;
    topCategories?: Array<{ category: string; amount: number }>;
    unprocessedBills?: number;
    lastUpdated?: string;
}

interface VehicleSummary {
    currentMileage?: number;
    lastFuelEfficiency?: number;
    nextMaintenanceDate?: string;
    lastUpdated?: string;
}

interface CalendarSummary {
    todayEvents?: Array<{ title: string; time: string }>;
    upcomingCount?: number;
    lastUpdated?: string;
}

interface UserPreferences {
    language?: string;
    timezone?: string;
    aiModel?: string;
    notificationEnabled?: boolean;
}

/**
 * Fetch aggregated user data from Firestore for AI context
 */
export async function getButlerContext(userId: string): Promise<ButlerContext> {
    const context: ButlerContext = {};

    const [health, finance, vehicle, calendar, preferences] = await Promise.allSettled([
        getHealthSummary(userId),
        getFinanceSummary(userId),
        getVehicleSummary(userId),
        getCalendarSummary(userId),
        getUserPreferences(userId),
    ]);

    if (health.status === 'fulfilled') context.health = health.value;
    if (finance.status === 'fulfilled') context.finance = finance.value;
    if (vehicle.status === 'fulfilled') context.vehicle = vehicle.value;
    if (calendar.status === 'fulfilled') context.calendar = calendar.value;
    if (preferences.status === 'fulfilled') context.preferences = preferences.value;

    return context;
}

async function getHealthSummary(userId: string): Promise<HealthSummary | undefined> {
    const snap = await db.collection(`users/${userId}/health_records`)
        .orderBy('timestamp', 'desc')
        .limit(7)
        .get();

    if (snap.empty) return undefined;

    const records = snap.docs.map(d => d.data());
    const latest = records[0];

    return {
        latestWeight: latest.weight,
        latestSteps: latest.steps,
        latestSleepHours: latest.sleepHours,
        weeklyExerciseMinutes: records.reduce((sum, r) => sum + (r.exerciseMinutes || 0), 0),
        lastUpdated: latest.timestamp?.toDate?.()?.toISOString(),
    };
}

async function getFinanceSummary(userId: string): Promise<FinanceSummary | undefined> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const snap = await db.collection(`users/${userId}/finance_transactions`)
        .where('date', '>=', monthStart)
        .orderBy('date', 'desc')
        .limit(100)
        .get();

    if (snap.empty) return undefined;

    const transactions = snap.docs.map(d => d.data());
    const categoryMap = new Map<string, number>();
    let total = 0;

    for (const tx of transactions) {
        const amount = tx.amount || 0;
        total += amount;
        const cat = tx.category || '未分類';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + amount);
    }

    const topCategories = Array.from(categoryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, amount]) => ({ category, amount }));

    return {
        monthlySpending: total,
        topCategories,
        lastUpdated: new Date().toISOString(),
    };
}

async function getVehicleSummary(userId: string): Promise<VehicleSummary | undefined> {
    const snap = await db.collection(`users/${userId}/vehicle_records`)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

    if (snap.empty) return undefined;

    const record = snap.docs[0].data();
    return {
        currentMileage: record.mileage,
        lastFuelEfficiency: record.fuelEfficiency,
        nextMaintenanceDate: record.nextMaintenance,
        lastUpdated: record.timestamp?.toDate?.()?.toISOString(),
    };
}

async function getCalendarSummary(userId: string): Promise<CalendarSummary | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [todaySnap, weekSnap] = await Promise.all([
        db.collection(`users/${userId}/calendar_events`)
            .where('startTime', '>=', today)
            .where('startTime', '<', tomorrow)
            .orderBy('startTime', 'asc')
            .limit(10)
            .get(),
        db.collection(`users/${userId}/calendar_events`)
            .where('startTime', '>=', tomorrow)
            .where('startTime', '<', nextWeek)
            .get(),
    ]);

    if (todaySnap.empty && weekSnap.empty) return undefined;

    return {
        todayEvents: todaySnap.docs.map(d => {
            const data = d.data();
            return {
                title: data.title || '',
                time: data.startTime?.toDate?.()?.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) || '',
            };
        }),
        upcomingCount: weekSnap.size,
        lastUpdated: new Date().toISOString(),
    };
}

async function getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const doc = await db.doc(`users/${userId}/butler_preferences/settings`).get();
    if (!doc.exists) return undefined;
    const data = doc.data();
    return {
        language: data?.language || 'zh-TW',
        timezone: data?.timezone || 'Asia/Taipei',
        aiModel: data?.aiModel,
        notificationEnabled: data?.notificationEnabled,
    };
}
