/**
 * Butler Service
 *
 * Core service for personal butler/secretary functionality.
 * Manages user profiles, health data sync, and notifications.
 */
import { ButlerProfile, UserProfile, HealthProfile, VehicleProfile, DailyHealthData } from '../types/butler.types';
export declare class ButlerService {
    /**
     * Initialize a new butler profile for a user
     */
    initializeProfile(uid: string, initialData: Partial<UserProfile>): Promise<ButlerProfile>;
    /**
     * Get the user's butler profile
     */
    getProfile(uid: string): Promise<ButlerProfile | null>;
    /**
     * Update user profile section
     */
    updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void>;
    /**
     * Update health profile
     */
    updateHealthProfile(uid: string, updates: Partial<HealthProfile>): Promise<void>;
    /**
     * Add a vehicle to the profile
     */
    addVehicle(uid: string, vehicle: VehicleProfile): Promise<void>;
    /**
     * Record daily health data (from Apple Watch / Garmin sync)
     */
    recordDailyHealth(uid: string, data: DailyHealthData): Promise<void>;
    /**
     * Get health data for a date range
     */
    getHealthHistory(uid: string, startDate: string, endDate: string): Promise<DailyHealthData[]>;
    /**
     * Calculate BMI
     */
    calculateBMI(heightCm: number, weightKg: number): {
        bmi: number;
        category: string;
    };
    /**
     * Calculate ideal weight range (BMI 18.5-24)
     */
    calculateIdealWeightRange(heightCm: number): {
        min: number;
        max: number;
    };
    /**
     * Get pending reminders for a user
     */
    getPendingReminders(uid: string): Promise<unknown[]>;
}
export declare const butlerService: ButlerService;
//# sourceMappingURL=butler.service.d.ts.map