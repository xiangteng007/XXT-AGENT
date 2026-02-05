"use strict";
/**
 * Butler Service
 *
 * Core service for personal butler/secretary functionality.
 * Manages user profiles, health data sync, and notifications.
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
exports.butlerService = exports.ButlerService = void 0;
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
class ButlerService {
    /**
     * Initialize a new butler profile for a user
     */
    async initializeProfile(uid, initialData) {
        const now = admin.firestore.Timestamp.now();
        const profile = {
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
    async getProfile(uid) {
        const doc = await db.doc(`users/${uid}/butler/profile`).get();
        if (!doc.exists) {
            return null;
        }
        return doc.data();
    }
    /**
     * Update user profile section
     */
    async updateUserProfile(uid, updates) {
        await db.doc(`users/${uid}/butler/profile`).update({
            'userProfile': admin.firestore.FieldValue.arrayUnion(updates),
            'userProfile.updatedAt': admin.firestore.Timestamp.now(),
            'updatedAt': admin.firestore.Timestamp.now(),
        });
    }
    /**
     * Update health profile
     */
    async updateHealthProfile(uid, updates) {
        const updateData = {
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
    async addVehicle(uid, vehicle) {
        await db.doc(`users/${uid}/butler/profile`).update({
            vehicles: admin.firestore.FieldValue.arrayUnion(vehicle),
            updatedAt: admin.firestore.Timestamp.now(),
        });
    }
    /**
     * Record daily health data (from Apple Watch / Garmin sync)
     */
    async recordDailyHealth(uid, data) {
        await db.doc(`users/${uid}/butler/health/daily/${data.date}`).set(data, { merge: true });
    }
    /**
     * Get health data for a date range
     */
    async getHealthHistory(uid, startDate, endDate) {
        const snapshot = await db
            .collection(`users/${uid}/butler/health/daily`)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'desc')
            .get();
        return snapshot.docs.map(doc => doc.data());
    }
    /**
     * Calculate BMI
     */
    calculateBMI(heightCm, weightKg) {
        const heightM = heightCm / 100;
        const bmi = weightKg / (heightM * heightM);
        let category;
        if (bmi < 18.5) {
            category = 'underweight';
        }
        else if (bmi < 24) {
            category = 'normal';
        }
        else if (bmi < 27) {
            category = 'overweight';
        }
        else {
            category = 'obese';
        }
        return { bmi: Math.round(bmi * 10) / 10, category };
    }
    /**
     * Calculate ideal weight range (BMI 18.5-24)
     */
    calculateIdealWeightRange(heightCm) {
        const heightM = heightCm / 100;
        return {
            min: Math.round(18.5 * heightM * heightM * 10) / 10,
            max: Math.round(24 * heightM * heightM * 10) / 10,
        };
    }
    /**
     * Get pending reminders for a user
     */
    async getPendingReminders(uid) {
        const now = new Date();
        const snapshot = await db
            .collection(`users/${uid}/butler/reminders`)
            .where('dueDate', '<=', now.toISOString().split('T')[0])
            .where('completed', '==', false)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
}
exports.ButlerService = ButlerService;
exports.butlerService = new ButlerService();
//# sourceMappingURL=butler.service.js.map