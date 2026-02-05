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

import * as admin from 'firebase-admin';
import {
    DailyHealthData,
    WorkoutSession,
    WeightLog,
} from '../types/butler.types';

const db = admin.firestore();

// ================================
// Health Data Constants
// ================================

export const HEALTH_CONSTANTS = {
    // BMI categories (Taiwan standards)
    BMI: {
        UNDERWEIGHT: 18.5,
        NORMAL_MAX: 24,
        OVERWEIGHT_MAX: 27,
    },
    // Target heart rate zones (% of max HR)
    HR_ZONES: {
        RECOVERY: { min: 0.5, max: 0.6 },
        FAT_BURN: { min: 0.6, max: 0.7 },
        CARDIO: { min: 0.7, max: 0.8 },
        PEAK: { min: 0.8, max: 0.9 },
    },
    // Daily goals
    DAILY_GOALS: {
        STEPS: 8000,
        ACTIVE_MINUTES: 30,
        WATER_ML: 2000,
        SLEEP_HOURS: 7,
    },
    // Calorie calculation (Harris-Benedict)
    CALORIE: {
        MALE_BMR_BASE: 88.362,
        MALE_WEIGHT_FACTOR: 13.397,
        MALE_HEIGHT_FACTOR: 4.799,
        MALE_AGE_FACTOR: 5.677,
    },
};

// ================================
// Health Service Class
// ================================

export class HealthService {
    /**
     * Calculate BMR (Basal Metabolic Rate) using Harris-Benedict equation
     */
    calculateBMR(gender: 'male' | 'female', weightKg: number, heightCm: number, ageYears: number): number {
        if (gender === 'male') {
            return Math.round(
                HEALTH_CONSTANTS.CALORIE.MALE_BMR_BASE +
                (HEALTH_CONSTANTS.CALORIE.MALE_WEIGHT_FACTOR * weightKg) +
                (HEALTH_CONSTANTS.CALORIE.MALE_HEIGHT_FACTOR * heightCm) -
                (HEALTH_CONSTANTS.CALORIE.MALE_AGE_FACTOR * ageYears)
            );
        } else {
            // Female formula
            return Math.round(
                447.593 +
                (9.247 * weightKg) +
                (3.098 * heightCm) -
                (4.330 * ageYears)
            );
        }
    }

    /**
     * Calculate BMI (Body Mass Index)
     * BMI = weight (kg) / height (m)²
     */
    calculateBMI(weightKg: number, heightCm: number): number {
        const heightM = heightCm / 100;
        return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
    }

    /**
     * Calculate TDEE (Total Daily Energy Expenditure)
     */
    calculateTDEE(bmr: number, activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'): number {
        const multipliers = {
            sedentary: 1.2,      // Little or no exercise
            light: 1.375,       // Light exercise 1-3 days/week
            moderate: 1.55,     // Moderate exercise 3-5 days/week
            active: 1.725,      // Hard exercise 6-7 days/week
            very_active: 1.9,   // Very hard exercise, physical job
        };
        return Math.round(bmr * multipliers[activityLevel]);
    }

    /**
     * Calculate max heart rate (220 - age formula)
     */
    calculateMaxHR(ageYears: number): number {
        return 220 - ageYears;
    }

    /**
     * Get target heart rate zone
     */
    getHeartRateZone(currentHR: number, maxHR: number): string {
        const percentage = currentHR / maxHR;
        
        if (percentage < HEALTH_CONSTANTS.HR_ZONES.RECOVERY.max) {
            return 'recovery';
        } else if (percentage < HEALTH_CONSTANTS.HR_ZONES.FAT_BURN.max) {
            return 'fat_burn';
        } else if (percentage < HEALTH_CONSTANTS.HR_ZONES.CARDIO.max) {
            return 'cardio';
        } else {
            return 'peak';
        }
    }

    /**
     * Calculate ideal weight range based on BMI 18.5-24
     */
    calculateIdealWeight(heightCm: number): { min: number; max: number; targetForUser: number } {
        const heightM = heightCm / 100;
        return {
            min: Math.round(18.5 * heightM * heightM * 10) / 10,
            max: Math.round(24 * heightM * heightM * 10) / 10,
            targetForUser: Math.round(22 * heightM * heightM * 10) / 10, // BMI 22 is optimal
        };
    }

    /**
     * Record daily health data
     */
    async recordDailyHealth(uid: string, data: DailyHealthData): Promise<void> {
        const docRef = db.doc(`users/${uid}/butler/health/daily/${data.date}`);
        
        // Merge with existing data
        await docRef.set({
            ...data,
            updatedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });
    }

    /**
     * Get today's health summary
     */
    async getTodayHealth(uid: string): Promise<DailyHealthData | null> {
        const today = new Date().toISOString().split('T')[0];
        const doc = await db.doc(`users/${uid}/butler/health/daily/${today}`).get();
        
        if (!doc.exists) {
            return null;
        }
        
        return doc.data() as DailyHealthData;
    }

    /**
     * Get health data for date range
     */
    async getHealthHistory(uid: string, startDate: string, endDate: string): Promise<DailyHealthData[]> {
        const snapshot = await db
            .collection(`users/${uid}/butler/health/daily`)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'desc')
            .get();
        
        return snapshot.docs.map(doc => doc.data() as DailyHealthData);
    }

    /**
     * Record a workout session
     */
    async recordWorkout(uid: string, workout: WorkoutSession): Promise<string> {
        const docRef = await db.collection(`users/${uid}/butler/health/workouts`).add({
            ...workout,
            createdAt: admin.firestore.Timestamp.now(),
        });
        
        // Also update daily totals
        const dateStr = workout.startTime instanceof Date 
            ? workout.startTime.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
            
        await this.updateDailyFromWorkout(uid, dateStr, workout);
        
        return docRef.id;
    }

    /**
     * Update daily totals from workout
     */
    private async updateDailyFromWorkout(uid: string, date: string, workout: WorkoutSession): Promise<void> {
        const docRef = db.doc(`users/${uid}/butler/health/daily/${date}`);
        
        const duration = workout.durationMinutes || workout.duration || 0;
        
        await docRef.set({
            activeMinutes: admin.firestore.FieldValue.increment(duration),
            caloriesBurned: admin.firestore.FieldValue.increment(workout.calories || 0),
            updatedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });
    }

    /**
     * Record weight log
     */
    async recordWeight(uid: string, weightKg: number, note?: string): Promise<void> {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        
        // Save to weight logs collection
        await db.collection(`users/${uid}/butler/health/weight`).add({
            date: dateStr,
            weight: weightKg,
            note: note || '',
            recordedAt: admin.firestore.Timestamp.now(),
        });
        
        // Update daily health
        await db.doc(`users/${uid}/butler/health/daily/${dateStr}`).set({
            weight: weightKg,
            updatedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });
        
        // Update profile
        await db.doc(`users/${uid}/butler/profile`).update({
            'userProfile.weight': weightKg,
            'userProfile.updatedAt': admin.firestore.Timestamp.now(),
        });
    }

    /**
     * Get weight history for trend analysis
     */
    async getWeightHistory(uid: string, days: number = 30): Promise<WeightLog[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const snapshot = await db
            .collection(`users/${uid}/butler/health/weight`)
            .where('date', '>=', startDateStr)
            .orderBy('date', 'asc')
            .get();
        
        return snapshot.docs.map(doc => doc.data() as WeightLog);
    }

    /**
     * Generate personalized exercise recommendation
     * Based on: No prior exercise habit, BMI 28.3 (overweight)
     */
    generateExerciseRecommendation(
        bmi: number,
        hasExerciseHabit: boolean,
        _preferredActivities: string[] = [],
    ): ExerciseRecommendation {
        // For beginners with high BMI
        if (!hasExerciseHabit && bmi >= 24) {
            return {
                phase: 'beginner',
                weeklyPlan: [
                    { day: 'monday', activity: '快走', duration: 20, intensity: 'low' },
                    { day: 'wednesday', activity: '快走', duration: 25, intensity: 'low' },
                    { day: 'friday', activity: '快走', duration: 20, intensity: 'low' },
                    { day: 'sunday', activity: '游泳或騎腳踏車', duration: 30, intensity: 'low' },
                ],
                targetHeartRateZone: 'fat_burn',
                tips: [
                    '從低強度開始，避免運動傷害',
                    '每次運動前後要做伸展',
                    '建議搭配飲食控制效果更佳',
                    '每週檢視並逐步增加運動量',
                ],
                weeklyGoal: {
                    totalMinutes: 90,
                    sessions: 4,
                },
                progressionPlan: {
                    week2: '每次增加 5 分鐘',
                    week4: '加入輕度肌力訓練',
                    week8: '考慮加入慢跑或 HIIT',
                },
            };
        }
        
        // Standard recommendation
        return {
            phase: 'maintenance',
            weeklyPlan: [
                { day: 'monday', activity: '有氧運動', duration: 30, intensity: 'moderate' },
                { day: 'tuesday', activity: '肌力訓練', duration: 45, intensity: 'moderate' },
                { day: 'thursday', activity: '有氧運動', duration: 30, intensity: 'moderate' },
                { day: 'friday', activity: '肌力訓練', duration: 45, intensity: 'moderate' },
                { day: 'saturday', activity: '戶外活動', duration: 60, intensity: 'low' },
            ],
            targetHeartRateZone: 'cardio',
            tips: ['保持規律運動習慣', '注意營養均衡'],
            weeklyGoal: {
                totalMinutes: 210,
                sessions: 5,
            },
        };
    }

    /**
     * Calculate weekly progress
     */
    async calculateWeeklyProgress(uid: string): Promise<WeeklyProgress> {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        
        const startDateStr = weekStart.toISOString().split('T')[0];
        const endDateStr = today.toISOString().split('T')[0];
        
        const healthData = await this.getHealthHistory(uid, startDateStr, endDateStr);
        
        const totalSteps = healthData.reduce((sum, d) => sum + (d.steps || 0), 0);
        const totalActiveMinutes = healthData.reduce((sum, d) => sum + (d.activeMinutes || 0), 0);
        const totalCaloriesBurned = healthData.reduce((sum, d) => sum + (d.caloriesBurned || 0), 0);
        const avgSleepHours = healthData.length > 0
            ? healthData.reduce((sum, d) => sum + (d.sleepHours || 0), 0) / healthData.length
            : 0;
        
        return {
            weekStart: startDateStr,
            weekEnd: endDateStr,
            daysRecorded: healthData.length,
            totals: {
                steps: totalSteps,
                activeMinutes: totalActiveMinutes,
                caloriesBurned: totalCaloriesBurned,
            },
            averages: {
                stepsPerDay: Math.round(totalSteps / (healthData.length || 1)),
                activeMinutesPerDay: Math.round(totalActiveMinutes / (healthData.length || 1)),
                sleepHours: Math.round(avgSleepHours * 10) / 10,
            },
            goals: {
                stepsAchieved: totalSteps >= HEALTH_CONSTANTS.DAILY_GOALS.STEPS * 7,
                activeMinutesAchieved: totalActiveMinutes >= HEALTH_CONSTANTS.DAILY_GOALS.ACTIVE_MINUTES * 7,
            },
        };
    }
}

// ================================
// Types
// ================================

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

export const healthService = new HealthService();
