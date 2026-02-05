/**
 * XXT-AGENT Personal Butler System Types
 *
 * Defines the data models for the personal butler/secretary functionality.
 * These types map to Firestore collections under users/{uid}/butler/
 */
export interface UserProfile {
    uid: string;
    displayName: string;
    gender: 'male' | 'female' | 'other';
    birthDate: string;
    height: number;
    weight: number;
    phone: string;
    email: string;
    emergencyContact?: EmergencyContact;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}
export interface EmergencyContact {
    name: string;
    relationship: string;
    phone: string;
}
export interface HealthProfile {
    allergies: string[];
    chronicConditions: string[];
    currentMedications: Medication[];
    lastCheckupDate?: string;
    familyHistory: string[];
    exercisePreferences: ExercisePreference;
    devices: HealthDevice[];
}
export interface Medication {
    name: string;
    dosage: string;
    frequency: string;
    time?: string[];
}
export interface ExercisePreference {
    hasHabit: boolean;
    interestedActivities: string[];
    preferredTimeSlots: string[];
    venues: string[];
    goals: string[];
    targetWeight?: number;
}
export interface HealthDevice {
    type: 'apple_watch' | 'garmin' | 'iphone' | 'ipad' | 'mac' | 'windows';
    model: string;
    accountId?: string;
    connected: boolean;
    lastSync?: FirebaseFirestore.Timestamp;
}
export interface DailyHealthData {
    date: string;
    steps: number;
    activeCalories?: number;
    caloriesBurned?: number;
    activeMinutes?: number;
    distanceKm?: number;
    restingHeartRate?: number;
    heartRate?: HeartRateData;
    sleepHours?: number;
    sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
    sleep?: SleepData;
    weight?: number;
    workouts?: WorkoutSession[];
    source?: 'apple_health' | 'garmin' | 'manual';
    syncedAt?: FirebaseFirestore.Timestamp | Date;
    updatedAt?: FirebaseFirestore.Timestamp;
}
export interface HeartRateData {
    average?: number;
    resting?: number;
    max?: number;
    min?: number;
}
export interface SleepData {
    duration: number;
    quality: number;
    deepMinutes?: number;
    lightMinutes?: number;
    remMinutes?: number;
    awakeMinutes?: number;
    bedTime?: string;
    wakeTime?: string;
}
export interface WorkoutSession {
    type: 'running' | 'cycling' | 'swimming' | 'walking' | 'strength' | 'yoga' | 'hiking' | 'other' | string;
    name?: string;
    duration?: number;
    durationMinutes?: number;
    calories?: number;
    distanceKm?: number;
    distance?: number;
    avgHeartRate?: number;
    heartRate?: {
        average?: number;
        max?: number;
    };
    startTime?: string | Date;
    endTime?: string | Date;
    source: 'apple_health' | 'garmin' | 'manual';
}
export interface WeightLog {
    date: string;
    weight: number;
    note?: string;
    recordedAt?: FirebaseFirestore.Timestamp;
}
export interface FinanceProfile {
    bankAccounts: BankAccount[];
    creditCards: CreditCard[];
    investmentAccounts: InvestmentAccount[];
    recurringPayments: RecurringPayment[];
}
export interface BankAccount {
    id: string;
    bankCode: '808' | '822' | '004' | '007';
    bankName: string;
    accountLast4: string;
    purpose: ('salary' | 'savings' | 'investment' | 'expense')[];
    nickname?: string;
    openBankingEnabled: boolean;
    lastBalance?: number;
    lastUpdated?: FirebaseFirestore.Timestamp;
}
export interface CreditCard {
    id: string;
    issuerBank: string;
    cardName: string;
    last4: string;
    paymentDueDay: number;
    primaryUse: string;
}
export interface InvestmentAccount {
    id: string;
    broker: string;
    accountLast4: string;
    types: ('tw_stock' | 'us_stock' | 'fund' | 'etf')[];
}
export interface RecurringPayment {
    id: string;
    name: string;
    dueDay: number;
    amount?: number;
    isAutoDebit: boolean;
    linkedBankId?: string;
}
export interface Transaction {
    id: string;
    bankAccountId: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    category: string;
    description: string;
    date: string;
    source: 'open_banking' | 'notification' | 'manual';
    createdAt: FirebaseFirestore.Timestamp;
}
export interface VehicleProfile {
    id: string;
    make: string;
    model: string;
    variant: string;
    year: number;
    licensePlate: string;
    currentMileage: number;
    purchaseDate: string;
    insuranceExpiry: string;
    inspectionExpiry: string;
    lastServiceDate?: string;
    lastServiceMileage?: number;
    modifications: VehicleModification[];
    fuelLogs: FuelLog[];
}
export interface VehicleModification {
    id: string;
    category: 'suspension' | 'tires' | 'roof_rack' | 'winch' | 'camping' | 'other';
    name: string;
    brand?: string;
    model?: string;
    installedDate?: string;
    notes?: string;
}
export interface FuelLog {
    id: string;
    date: string;
    mileage: number;
    liters: number;
    pricePerLiter: number;
    totalCost: number;
    station?: string;
    isFull: boolean;
}
export interface MaintenanceSchedule {
    type: 'service' | 'insurance' | 'inspection' | 'tire_rotation';
    nextDueDate?: string;
    nextDueMileage?: number;
    intervalDays?: number;
    intervalMileage?: number;
    lastCompleted?: string;
}
export interface BusinessProfile {
    companyName: string;
    taxId: string;
    address: string;
    phone: string;
    establishedDate: string;
    employeeCount: number;
    businessTypes: BusinessType[];
    integratedSystems: IntegratedSystem[];
}
export interface BusinessType {
    type: 'interior_design' | 'architecture' | 'construction' | 'supervision' | 'other';
    name: string;
    revenueRatio: number;
}
export interface IntegratedSystem {
    category: 'project_mgmt' | 'accounting' | 'crm' | 'design' | 'cloud_storage';
    name: string;
    needsIntegration: boolean;
    apiEndpoint?: string;
}
export interface DisasterReliefProfile {
    participatedEvents: DisasterEvent[];
    organization?: string;
    role?: string;
    certifications: string[];
    isActive: boolean;
}
export interface DisasterEvent {
    name: string;
    year: number;
    location?: string;
    role?: string;
}
export interface LifestylePreferences {
    schedule: DailySchedule;
    diet: DietPreference;
    notifications: NotificationPreferences;
}
export interface DailySchedule {
    weekdayWakeTime: string;
    weekdaySleepTime: string;
    weekendWakeTime: string;
    weekendSleepTime: string;
}
export interface DietPreference {
    type: 'omnivore' | 'vegetarian' | 'vegan' | 'religious';
    religiousRestriction?: string;
    allergies: string[];
    coffeePerDay: number;
    alcoholFrequency: 'never' | 'occasionally' | 'frequently';
}
export interface NotificationPreferences {
    emergencyChannels: NotificationChannel[];
    calendarChannels: NotificationChannel[];
    financeChannels: NotificationChannel[];
    healthChannels: NotificationChannel[];
    doNotDisturbStart?: string;
    doNotDisturbEnd?: string;
}
export type NotificationChannel = 'line' | 'telegram' | 'email' | 'phone' | 'watch' | 'app';
/**
 * Main butler document stored at users/{uid}/butler/profile
 * Contains references to all subcollections
 */
export interface ButlerProfile {
    version: string;
    userProfile: UserProfile;
    healthProfile: HealthProfile;
    financeProfile: FinanceProfile;
    vehicles: VehicleProfile[];
    business?: BusinessProfile;
    disasterRelief?: DisasterReliefProfile;
    lifestyle: LifestylePreferences;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}
export declare const BUTLER_COLLECTIONS: {
    readonly PROFILE: "users/{uid}/butler/profile";
    readonly HEALTH_DAILY: "users/{uid}/butler/health/daily/{date}";
    readonly TRANSACTIONS: "users/{uid}/butler/finance/transactions";
    readonly FUEL_LOGS: "users/{uid}/butler/vehicles/{vehicleId}/fuel";
    readonly MAINTENANCE: "users/{uid}/butler/vehicles/{vehicleId}/maintenance";
    readonly REMINDERS: "users/{uid}/butler/reminders";
};
//# sourceMappingURL=butler.types.d.ts.map