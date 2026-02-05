/**
 * Health Integration Service
 *
 * Provides unified health data management for:
 * - Apple Watch / HealthKit (via iOS app sync)
 * - Garmin Connect API
 * - Manual health data entry
 *
 * Designed for user profile: Male, 170cm, 81.8kg, no prior exercise habit
 */
import { DailyHealthData, WorkoutSession, WeightLog } from '../types/butler.types';
export declare const HEALTH_CONSTANTS: {
    BMI: {
        UNDERWEIGHT: number;
        NORMAL_MAX: number;
        OVERWEIGHT_MAX: number;
    };
    HR_ZONES: {
        RECOVERY: {
            min: number;
            max: number;
        };
        FAT_BURN: {
            min: number;
            max: number;
        };
        CARDIO: {
            min: number;
            max: number;
        };
        PEAK: {
            min: number;
            max: number;
        };
    };
    DAILY_GOALS: {
        STEPS: number;
        ACTIVE_MINUTES: number;
        WATER_ML: number;
        SLEEP_HOURS: number;
    };
    CALORIE: {
        MALE_BMR_BASE: number;
        MALE_WEIGHT_FACTOR: number;
        MALE_HEIGHT_FACTOR: number;
        MALE_AGE_FACTOR: number;
    };
};
export declare class HealthService {
    /**
     * Calculate BMR (Basal Metabolic Rate) using Harris-Benedict equation
     */
    calculateBMR(gender: 'male' | 'female', weightKg: number, heightCm: number, ageYears: number): number;
    /**
     * Calculate BMI (Body Mass Index)
     * BMI = weight (kg) / height (m)²
     */
    calculateBMI(weightKg: number, heightCm: number): number;
    /**
     * Calculate TDEE (Total Daily Energy Expenditure)
     */
    calculateTDEE(bmr: number, activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'): number;
    /**
     * Calculate max heart rate (220 - age formula)
     */
    calculateMaxHR(ageYears: number): number;
    /**
     * Get target heart rate zone
     */
    getHeartRateZone(currentHR: number, maxHR: number): string;
    /**
     * Calculate ideal weight range based on BMI 18.5-24
     */
    calculateIdealWeight(heightCm: number): {
        min: number;
        max: number;
        targetForUser: number;
    };
    /**
     * Record daily health data
     */
    recordDailyHealth(uid: string, data: DailyHealthData): Promise<void>;
    /**
     * Get today's health summary
     */
    getTodayHealth(uid: string): Promise<DailyHealthData | null>;
    /**
     * Get health data for date range
     */
    getHealthHistory(uid: string, startDate: string, endDate: string): Promise<DailyHealthData[]>;
    /**
     * Record a workout session
     */
    recordWorkout(uid: string, workout: WorkoutSession): Promise<string>;
    /**
     * Update daily totals from workout
     */
    private updateDailyFromWorkout;
    /**
     * Record weight log
     */
    recordWeight(uid: string, weightKg: number, note?: string): Promise<void>;
    /**
     * Get weight history for trend analysis
     */
    getWeightHistory(uid: string, days?: number): Promise<WeightLog[]>;
    /**
     * Generate personalized exercise recommendation
     * Based on: No prior exercise habit, BMI 28.3 (overweight)
     */
    generateExerciseRecommendation(bmi: number, hasExerciseHabit: boolean, _preferredActivities?: string[]): ExerciseRecommendation;
    /**
     * Calculate weekly progress
     */
    calculateWeeklyProgress(uid: string): Promise<WeeklyProgress>;
}
export interface ExerciseRecommendation {
    phase: 'beginner' | 'intermediate' | 'advanced' | 'maintenance';
    weeklyPlan: {
        day: string;
        activity: string;
        duration: number;
        intensity: 'low' | 'moderate' | 'high';
    }[];
    targetHeartRateZone: string;
    tips: string[];
    weeklyGoal: {
        totalMinutes: number;
        sessions: number;
    };
    progressionPlan?: Record<string, string>;
}
export interface WeeklyProgress {
    weekStart: string;
    weekEnd: string;
    daysRecorded: number;
    totals: {
        steps: number;
        activeMinutes: number;
        caloriesBurned: number;
    };
    averages: {
        stepsPerDay: number;
        activeMinutesPerDay: number;
        sleepHours: number;
    };
    goals: {
        stepsAchieved: boolean;
        activeMinutesAchieved: boolean;
    };
}
export declare const healthService: HealthService;
//# sourceMappingURL=health.service.d.ts.map