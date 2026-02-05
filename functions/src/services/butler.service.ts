/**
 * Butler Service
 * 
 * Core service for personal butler/secretary functionality.
 * Manages user profiles, health data sync, and notifications.
 */

import * as admin from 'firebase-admin';
import {
  ButlerProfile,
  UserProfile,
  HealthProfile,
  VehicleProfile,
  DailyHealthData,
} from '../types/butler.types';

const db = admin.firestore();

export class ButlerService {
  /**
   * Initialize a new butler profile for a user
   */
  async initializeProfile(uid: string, initialData: Partial<UserProfile>): Promise<ButlerProfile> {
    const now = admin.firestore.Timestamp.now();
    
    const profile: ButlerProfile = {
      version: '1.0.0',
      userProfile: {
        uid,
        displayName: initialData.displayName || '',
        gender: initialData.gender || 'male',
        birthDate: initialData.birthDate || '',
        height: initialData.height || 0,
        weight: initialData.weight || 0,
        phone: initialData.phone || '',
        email: initialData.email || '',
        createdAt: now,
        updatedAt: now,
      },
      healthProfile: {
        allergies: [],
        chronicConditions: [],
        currentMedications: [],
        familyHistory: [],
        exercisePreferences: {
          hasHabit: false,
          interestedActivities: [],
          preferredTimeSlots: [],
          venues: [],
          goals: [],
        },
        devices: [],
      },
      financeProfile: {
        bankAccounts: [],
        creditCards: [],
        investmentAccounts: [],
        recurringPayments: [],
      },
      vehicles: [],
      lifestyle: {
        schedule: {
          weekdayWakeTime: '07:00',
          weekdaySleepTime: '23:00',
          weekendWakeTime: '08:00',
          weekendSleepTime: '00:00',
        },
        diet: {
          type: 'omnivore',
          allergies: [],
          coffeePerDay: 0,
          alcoholFrequency: 'occasionally',
        },
        notifications: {
          emergencyChannels: ['line', 'telegram'],
          calendarChannels: ['line'],
          financeChannels: ['line'],
          healthChannels: ['line'],
        },
      },
      createdAt: now,
      updatedAt: now,
    };

    await db.doc(`users/${uid}/butler/profile`).set(profile);
    
    return profile;
  }

  /**
   * Get the user's butler profile
   */
  async getProfile(uid: string): Promise<ButlerProfile | null> {
    const doc = await db.doc(`users/${uid}/butler/profile`).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as ButlerProfile;
  }

  /**
   * Update user profile section
   */
  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    await db.doc(`users/${uid}/butler/profile`).update({
      'userProfile': admin.firestore.FieldValue.arrayUnion(updates),
      'userProfile.updatedAt': admin.firestore.Timestamp.now(),
      'updatedAt': admin.firestore.Timestamp.now(),
    });
  }

  /**
   * Update health profile
   */
  async updateHealthProfile(uid: string, updates: Partial<HealthProfile>): Promise<void> {
    const updateData: Record<string, unknown> = {
      updatedAt: admin.firestore.Timestamp.now(),
    };
    
    // Flatten the updates to use dot notation
    for (const [key, value] of Object.entries(updates)) {
      updateData[`healthProfile.${key}`] = value;
    }
    
    await db.doc(`users/${uid}/butler/profile`).update(updateData);
  }

  /**
   * Add a vehicle to the profile
   */
  async addVehicle(uid: string, vehicle: VehicleProfile): Promise<void> {
    await db.doc(`users/${uid}/butler/profile`).update({
      vehicles: admin.firestore.FieldValue.arrayUnion(vehicle),
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }

  /**
   * Record daily health data (from Apple Watch / Garmin sync)
   */
  async recordDailyHealth(uid: string, data: DailyHealthData): Promise<void> {
    await db.doc(`users/${uid}/butler/health/daily/${data.date}`).set(data, { merge: true });
  }

  /**
   * Get health data for a date range
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
   * Calculate BMI
   */
  calculateBMI(heightCm: number, weightKg: number): { bmi: number; category: string } {
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    
    let category: string;
    if (bmi < 18.5) {
      category = 'underweight';
    } else if (bmi < 24) {
      category = 'normal';
    } else if (bmi < 27) {
      category = 'overweight';
    } else {
      category = 'obese';
    }
    
    return { bmi: Math.round(bmi * 10) / 10, category };
  }

  /**
   * Calculate ideal weight range (BMI 18.5-24)
   */
  calculateIdealWeightRange(heightCm: number): { min: number; max: number } {
    const heightM = heightCm / 100;
    return {
      min: Math.round(18.5 * heightM * heightM * 10) / 10,
      max: Math.round(24 * heightM * heightM * 10) / 10,
    };
  }

  /**
   * Get pending reminders for a user
   */
  async getPendingReminders(uid: string): Promise<unknown[]> {
    const now = new Date();
    const snapshot = await db
      .collection(`users/${uid}/butler/reminders`)
      .where('dueDate', '<=', now.toISOString().split('T')[0])
      .where('completed', '==', false)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}

export const butlerService = new ButlerService();
