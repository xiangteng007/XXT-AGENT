"use strict";
/**
 * Garmin Connect Adapter
 *
 * Handles Garmin Connect API integration for health data sync.
 * Supports: Activities, Sleep, Heart Rate, Steps, Body Composition
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
exports.garminAdapter = exports.GarminConnectAdapter = void 0;
exports.processAppleHealthSync = processAppleHealthSync;
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// ================================
// Garmin OAuth Configuration
// ================================
const GARMIN_API_BASE = 'https://apis.garmin.com';
// ================================
// Garmin Connect Adapter
// ================================
class GarminConnectAdapter {
    consumerKey;
    consumerSecret;
    constructor() {
        this.consumerKey = process.env.GARMIN_CONSUMER_KEY || '';
        this.consumerSecret = process.env.GARMIN_CONSUMER_SECRET || '';
    }
    /**
     * Check if Garmin is configured
     */
    isConfigured() {
        return !!(this.consumerKey && this.consumerSecret);
    }
    /**
     * Get stored user tokens
     */
    async getUserTokens(uid) {
        const doc = await db.doc(`users/${uid}/butler/integrations/garmin`).get();
        if (!doc.exists) {
            return null;
        }
        return doc.data();
    }
    /**
     * Store user tokens after OAuth
     */
    async storeUserTokens(uid, tokens) {
        await db.doc(`users/${uid}/butler/integrations/garmin`).set({
            ...tokens,
            connectedAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        });
    }
    /**
     * Fetch daily summary from Garmin
     */
    async fetchDailySummary(uid, date) {
        const tokens = await this.getUserTokens(uid);
        if (!tokens) {
            throw new Error('Garmin not connected. Please authorize first.');
        }
        // Note: In production, use OAuth1.0a signed requests
        const url = `${GARMIN_API_BASE}/wellness-api/rest/dailies/${date}`;
        try {
            const response = await this.makeSignedRequest(url, tokens);
            return response;
        }
        catch (error) {
            console.error('Garmin daily summary fetch failed:', error);
            return null;
        }
    }
    /**
     * Fetch sleep data from Garmin
     */
    async fetchSleepData(uid, date) {
        const tokens = await this.getUserTokens(uid);
        if (!tokens) {
            throw new Error('Garmin not connected');
        }
        const url = `${GARMIN_API_BASE}/wellness-api/rest/sleeps/${date}`;
        try {
            const response = await this.makeSignedRequest(url, tokens);
            return response;
        }
        catch (error) {
            console.error('Garmin sleep fetch failed:', error);
            return null;
        }
    }
    /**
     * Fetch recent activities from Garmin
     */
    async fetchActivities(uid, startDate, endDate) {
        const tokens = await this.getUserTokens(uid);
        if (!tokens) {
            throw new Error('Garmin not connected');
        }
        const url = `${GARMIN_API_BASE}/wellness-api/rest/activities?startDate=${startDate}&endDate=${endDate}`;
        try {
            const response = await this.makeSignedRequest(url, tokens);
            return response.activities || [];
        }
        catch (error) {
            console.error('Garmin activities fetch failed:', error);
            return [];
        }
    }
    /**
     * Sync Garmin data to Firestore
     */
    async syncToFirestore(uid, date) {
        const [daily, sleep] = await Promise.all([
            this.fetchDailySummary(uid, date),
            this.fetchSleepData(uid, date),
        ]);
        if (!daily) {
            return null;
        }
        const healthData = {
            date,
            steps: daily.totalSteps || 0,
            activeMinutes: (daily.moderateIntensityMinutes || 0) + (daily.vigorousIntensityMinutes || 0),
            caloriesBurned: daily.activeKilocalories || 0,
            distanceKm: (daily.totalDistanceMeters || 0) / 1000,
            heartRate: daily.restingHeartRate ? {
                resting: daily.restingHeartRate,
                max: daily.maxHeartRate,
                average: undefined,
            } : undefined,
            sleepHours: sleep ? sleep.sleepTimeSeconds / 3600 : undefined,
            sleep: sleep ? {
                duration: sleep.sleepTimeSeconds / 60,
                quality: this.calculateSleepQuality(sleep),
                deepMinutes: sleep.deepSleepSeconds / 60,
                lightMinutes: sleep.lightSleepSeconds / 60,
                remMinutes: sleep.remSleepSeconds / 60,
                awakeMinutes: sleep.awakeSleepSeconds / 60,
                bedTime: new Date(sleep.sleepStartTimestampGMT).toISOString(),
                wakeTime: new Date(sleep.sleepEndTimestampGMT).toISOString(),
            } : undefined,
            source: 'garmin',
            syncedAt: admin.firestore.Timestamp.now(),
        };
        // Save to Firestore
        await db.doc(`users/${uid}/butler/health/daily/${date}`).set(healthData, { merge: true });
        return healthData;
    }
    /**
     * Convert Garmin activity to workout session
     */
    mapActivityToWorkout(activity) {
        const activityTypeMap = {
            'running': 'running',
            'cycling': 'cycling',
            'swimming': 'swimming',
            'walking': 'walking',
            'strength_training': 'strength',
            'yoga': 'yoga',
            'hiking': 'hiking',
        };
        return {
            type: activityTypeMap[activity.activityType.typeKey] || 'other',
            name: activity.activityName,
            startTime: new Date(activity.startTimeLocal),
            durationMinutes: Math.round(activity.duration / 60),
            calories: activity.calories,
            distanceKm: activity.distance ? activity.distance / 1000 : undefined,
            heartRate: activity.averageHR ? {
                average: activity.averageHR,
                max: activity.maxHeartRate,
            } : undefined,
            source: 'garmin',
        };
    }
    /**
     * Calculate sleep quality score (0-100)
     */
    calculateSleepQuality(sleep) {
        if (sleep.sleepScores?.totalScore) {
            return sleep.sleepScores.totalScore;
        }
        const totalMinutes = sleep.sleepTimeSeconds / 60;
        const deepPercentage = (sleep.deepSleepSeconds / sleep.sleepTimeSeconds) * 100;
        const remPercentage = (sleep.remSleepSeconds / sleep.sleepTimeSeconds) * 100;
        let score = 50; // Base score
        // Duration bonus (7-9 hours is ideal)
        if (totalMinutes >= 420 && totalMinutes <= 540) {
            score += 20;
        }
        else if (totalMinutes >= 360 && totalMinutes <= 600) {
            score += 10;
        }
        // Deep sleep bonus (15-25% is ideal)
        if (deepPercentage >= 15 && deepPercentage <= 25) {
            score += 15;
        }
        else if (deepPercentage >= 10) {
            score += 5;
        }
        // REM bonus (20-25% is ideal)
        if (remPercentage >= 20 && remPercentage <= 25) {
            score += 15;
        }
        else if (remPercentage >= 15) {
            score += 5;
        }
        return Math.min(100, Math.max(0, score));
    }
    /**
     * Make OAuth1.0a signed request (placeholder)
     * In production, use a proper OAuth1.0a library
     */
    async makeSignedRequest(url, tokens) {
        // This is a placeholder - in production, implement proper OAuth1.0a signing
        // using libraries like 'oauth-1.0a' or 'simple-oauth2'
        console.log(`Making Garmin API request to: ${url}`);
        console.log(`Using token for user: ${tokens.userId}`);
        // For now, return mock data for development
        throw new Error('OAuth1.0a signing not implemented. Use Garmin Webhook Push instead.');
    }
}
exports.GarminConnectAdapter = GarminConnectAdapter;
/**
 * Process Apple HealthKit sync payload
 */
async function processAppleHealthSync(payload) {
    const uid = payload.userId;
    const date = payload.syncTimestamp.split('T')[0];
    const data = payload.data;
    const healthData = {
        date,
        steps: data.steps || 0,
        caloriesBurned: (data.activeEnergy || 0) + (data.restingEnergy || 0),
        activeMinutes: 0, // Calculated from workouts
        heartRate: data.heartRate ? {
            average: data.heartRate.average,
            resting: data.heartRate.resting,
            max: data.heartRate.max,
        } : undefined,
        weight: data.weight,
        sleep: data.sleep ? {
            duration: data.sleep.asleepMinutes,
            quality: calculateAppleSleepQuality(data.sleep),
            deepMinutes: data.sleep.deepMinutes,
            remMinutes: data.sleep.remMinutes,
            lightMinutes: data.sleep.asleepMinutes - (data.sleep.deepMinutes || 0) - (data.sleep.remMinutes || 0),
            awakeMinutes: data.sleep.awakeMinutes,
            bedTime: data.sleep.startTime,
            wakeTime: data.sleep.endTime,
        } : undefined,
        sleepHours: data.sleep ? data.sleep.asleepMinutes / 60 : undefined,
        source: 'apple_health',
        syncedAt: new Date(),
    };
    // Calculate active minutes from workouts
    if (data.workouts && data.workouts.length > 0) {
        healthData.activeMinutes = data.workouts.reduce((sum, w) => sum + w.duration, 0);
    }
    // Save to Firestore
    await db.doc(`users/${uid}/butler/health/daily/${date}`).set(healthData, { merge: true });
    // Process workouts
    if (data.workouts) {
        for (const workout of data.workouts) {
            await db.collection(`users/${uid}/butler/health/workouts`).add({
                type: mapAppleWorkoutType(workout.type),
                name: workout.type,
                startTime: new Date(workout.startTime),
                endTime: new Date(workout.endTime),
                durationMinutes: workout.duration,
                calories: workout.calories,
                distanceKm: workout.distance ? workout.distance / 1000 : undefined,
                heartRate: workout.heartRate,
                source: 'apple_health',
                createdAt: admin.firestore.Timestamp.now(),
            });
        }
    }
    // Update weight in profile if provided
    if (data.weight) {
        await db.doc(`users/${uid}/butler/profile`).update({
            'userProfile.weight': data.weight,
            'userProfile.updatedAt': admin.firestore.Timestamp.now(),
        });
    }
    return healthData;
}
function calculateAppleSleepQuality(sleep) {
    if (!sleep)
        return 0;
    let score = 50;
    // Duration bonus
    const hours = sleep.asleepMinutes / 60;
    if (hours >= 7 && hours <= 9) {
        score += 25;
    }
    else if (hours >= 6) {
        score += 10;
    }
    // Deep sleep bonus
    if (sleep.deepMinutes) {
        const deepPercentage = (sleep.deepMinutes / sleep.asleepMinutes) * 100;
        if (deepPercentage >= 15 && deepPercentage <= 25) {
            score += 15;
        }
    }
    // Low wake time bonus
    const wakePercentage = (sleep.awakeMinutes / sleep.inBedMinutes) * 100;
    if (wakePercentage < 10) {
        score += 10;
    }
    return Math.min(100, Math.max(0, score));
}
function mapAppleWorkoutType(appleType) {
    const typeMap = {
        'HKWorkoutActivityTypeRunning': 'running',
        'HKWorkoutActivityTypeCycling': 'cycling',
        'HKWorkoutActivityTypeSwimming': 'swimming',
        'HKWorkoutActivityTypeWalking': 'walking',
        'HKWorkoutActivityTypeTraditionalStrengthTraining': 'strength',
        'HKWorkoutActivityTypeYoga': 'yoga',
        'HKWorkoutActivityTypeHiking': 'hiking',
        'HKWorkoutActivityTypeFunctionalStrengthTraining': 'strength',
    };
    return typeMap[appleType] || 'other';
}
exports.garminAdapter = new GarminConnectAdapter();
//# sourceMappingURL=health-integrations.service.js.map