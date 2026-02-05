/**
 * Garmin Connect Adapter
 *
 * Handles Garmin Connect API integration for health data sync.
 * Supports: Activities, Sleep, Heart Rate, Steps, Body Composition
 */
import { DailyHealthData, WorkoutSession } from '../types/butler.types';
interface GarminActivitySummary {
    activityId: number;
    activityName: string;
    startTimeLocal: string;
    duration: number;
    distance?: number;
    calories?: number;
    averageHR?: number;
    maxHeartRate?: number;
    steps?: number;
    activityType: {
        typeKey: string;
        typeId: number;
    };
}
interface GarminDailySummary {
    calendarDate: string;
    totalSteps: number;
    totalDistanceMeters: number;
    activeKilocalories: number;
    moderateIntensityMinutes: number;
    vigorousIntensityMinutes: number;
    restingHeartRate?: number;
    maxHeartRate?: number;
    averageStressLevel?: number;
}
interface GarminSleepData {
    calendarDate: string;
    sleepTimeSeconds: number;
    deepSleepSeconds: number;
    lightSleepSeconds: number;
    remSleepSeconds: number;
    awakeSleepSeconds: number;
    sleepStartTimestampGMT: number;
    sleepEndTimestampGMT: number;
    averageSpO2?: number;
    sleepScores?: {
        totalScore: number;
        qualityScore: number;
        recoveryScore: number;
    };
}
interface GarminTokens {
    accessToken: string;
    accessTokenSecret: string;
    userId: string;
}
export declare class GarminConnectAdapter {
    private consumerKey;
    private consumerSecret;
    constructor();
    /**
     * Check if Garmin is configured
     */
    isConfigured(): boolean;
    /**
     * Get stored user tokens
     */
    getUserTokens(uid: string): Promise<GarminTokens | null>;
    /**
     * Store user tokens after OAuth
     */
    storeUserTokens(uid: string, tokens: GarminTokens): Promise<void>;
    /**
     * Fetch daily summary from Garmin
     */
    fetchDailySummary(uid: string, date: string): Promise<GarminDailySummary | null>;
    /**
     * Fetch sleep data from Garmin
     */
    fetchSleepData(uid: string, date: string): Promise<GarminSleepData | null>;
    /**
     * Fetch recent activities from Garmin
     */
    fetchActivities(uid: string, startDate: string, endDate: string): Promise<GarminActivitySummary[]>;
    /**
     * Sync Garmin data to Firestore
     */
    syncToFirestore(uid: string, date: string): Promise<DailyHealthData | null>;
    /**
     * Convert Garmin activity to workout session
     */
    mapActivityToWorkout(activity: GarminActivitySummary): Partial<WorkoutSession>;
    /**
     * Calculate sleep quality score (0-100)
     */
    private calculateSleepQuality;
    /**
     * Make OAuth1.0a signed request (placeholder)
     * In production, use a proper OAuth1.0a library
     */
    private makeSignedRequest;
}
/**
 * Apple HealthKit data is synced from iOS app via HTTPS endpoint.
 * The iOS app reads HealthKit data and POSTs to our Cloud Function.
 */
export interface AppleHealthPayload {
    userId: string;
    deviceId: string;
    syncTimestamp: string;
    data: {
        steps?: number;
        activeEnergy?: number;
        restingEnergy?: number;
        heartRate?: {
            average: number;
            min: number;
            max: number;
            resting?: number;
        };
        sleep?: {
            startTime: string;
            endTime: string;
            inBedMinutes: number;
            asleepMinutes: number;
            awakeMinutes: number;
            deepMinutes?: number;
            remMinutes?: number;
        };
        workouts?: {
            type: string;
            startTime: string;
            endTime: string;
            duration: number;
            calories: number;
            distance?: number;
            heartRate?: {
                average: number;
                max: number;
            };
        }[];
        weight?: number;
        bodyFat?: number;
    };
}
/**
 * Process Apple HealthKit sync payload
 */
export declare function processAppleHealthSync(payload: AppleHealthPayload): Promise<DailyHealthData>;
export declare const garminAdapter: GarminConnectAdapter;
export {};
//# sourceMappingURL=health-integrations.service.d.ts.map