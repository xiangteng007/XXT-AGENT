/**
 * XXT-AGENT Personal Butler System Types
 * 
 * Defines the data models for the personal butler/secretary functionality.
 * These types map to Firestore collections under users/{uid}/butler/
 */

// ========================
// A. Basic Profile
// ========================

export interface UserProfile {
  uid: string;
  displayName: string;
  gender: 'male' | 'female' | 'other';
  birthDate: string; // ISO date string YYYY-MM-DD
  height: number; // cm
  weight: number; // kg (latest)
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

// ========================
// B. Health & Fitness
// ========================

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
  frequency: string; // e.g., "daily", "twice daily"
  time?: string[]; // e.g., ["08:00", "20:00"]
}

export interface ExercisePreference {
  hasHabit: boolean;
  interestedActivities: string[]; // running, gym, swimming, cycling, hiking
  preferredTimeSlots: string[]; // morning, afternoon, evening, weekend
  venues: string[]; // nearby park, gym, home
  goals: string[]; // weight loss, muscle gain, cardio, maintenance
  targetWeight?: number;
}

export interface HealthDevice {
  type: 'apple_watch' | 'garmin' | 'iphone' | 'ipad' | 'mac' | 'windows';
  model: string;
  accountId?: string; // Apple ID or Garmin Connect ID
  connected: boolean;
  lastSync?: FirebaseFirestore.Timestamp;
}

// Daily health data synced from devices
export interface DailyHealthData {
  date: string; // YYYY-MM-DD
  steps: number;
  activeCalories?: number;
  caloriesBurned?: number; // Total calories burned
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
  duration: number; // total minutes
  quality: number; // 0-100 score
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
  duration?: number; // minutes (for backward compatibility)
  durationMinutes?: number; // minutes
  calories?: number;
  distanceKm?: number;
  distance?: number; // meters (for backward compatibility)
  avgHeartRate?: number;
  heartRate?: { average?: number; max?: number };
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

// ========================
// C. Finance
// ========================

export interface FinanceProfile {
  bankAccounts: BankAccount[];
  creditCards: CreditCard[];
  investmentAccounts: InvestmentAccount[];
  recurringPayments: RecurringPayment[];
}

export interface BankAccount {
  id: string;
  bankCode: '808' | '822' | '004' | '007'; // 玉山, 中信, 台銀, 第一
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
  paymentDueDay: number; // 1-31
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
  name: string; // rent, utilities, internet, insurance
  dueDay: number;
  amount?: number;
  isAutoDebit: boolean;
  linkedBankId?: string;
}

// Transaction record
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

// Investment holding in portfolio
export interface InvestmentHolding {
  id: string;
  symbol: string; // e.g., '2330', '0050', 'AAPL'
  name: string;
  type: 'tw_stock' | 'us_stock' | 'etf' | 'fund' | 'bond' | 'crypto';
  shares: number;
  avgCost: number;
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnL?: number;
  currency: 'TWD' | 'USD';
  brokerId?: string;
  lastUpdated?: FirebaseFirestore.Timestamp;
}

// Investment transaction (buy/sell/dividend)
export interface InvestmentTransaction {
  id: string;
  holdingId: string;
  type: 'buy' | 'sell' | 'dividend' | 'split';
  symbol: string;
  shares: number;
  price: number;
  totalAmount: number;
  fee: number;
  date: string;
  note?: string;
  createdAt: FirebaseFirestore.Timestamp;
}

// Loan record
export interface Loan {
  id: string;
  name: string;
  type: 'mortgage' | 'car' | 'personal' | 'student' | 'credit';
  lender: string;
  principal: number;
  interestRate: number; // annual %
  termMonths: number;
  startDate: string;
  monthlyPayment: number;
  remainingBalance: number;
  totalPaid?: number;
  nextPaymentDate?: string;
  isActive: boolean;
  createdAt: FirebaseFirestore.Timestamp;
}

// Tax profile for estimation
export interface TaxProfile {
  annualSalary?: number;
  businessIncome?: number;
  investmentIncome?: number;
  rentalIncome?: number;
  otherIncome?: number;
  deductions: TaxDeduction[];
  filingStatus: 'single' | 'married' | 'business';
  dependents: number;
  year: number;
}

export interface TaxDeduction {
  type: 'insurance' | 'medical' | 'education' | 'charity' | 'mortgage_interest' | 'rental' | 'disability' | 'childcare' | 'elderly_care' | 'other';
  amount: number;
  description: string;
}

// ========================
// D. Vehicle (Jimny JB74)
// ========================

export interface VehicleProfile {
  id: string;
  make: string; // Suzuki
  model: string; // Jimny
  variant: string; // JB74
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
  isFull: boolean; // full tank fill
}

// Maintenance reminders
export interface MaintenanceSchedule {
  type: 'service' | 'insurance' | 'inspection' | 'tire_rotation';
  nextDueDate?: string;
  nextDueMileage?: number;
  intervalDays?: number;
  intervalMileage?: number;
  lastCompleted?: string;
}

// ========================
// E. Business (Interior Design Company)
// ========================

export interface BusinessProfile {
  companyName: string;
  taxId: string; // 統一編號
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
  revenueRatio: number; // percentage
}

export interface IntegratedSystem {
  category: 'project_mgmt' | 'accounting' | 'crm' | 'design' | 'cloud_storage';
  name: string;
  needsIntegration: boolean;
  apiEndpoint?: string;
}

// ========================
// F. Emergency & Disaster Relief
// ========================

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

// ========================
// G. Lifestyle Preferences
// ========================

export interface LifestylePreferences {
  schedule: DailySchedule;
  diet: DietPreference;
  notifications: NotificationPreferences;
}

export interface DailySchedule {
  weekdayWakeTime: string; // HH:MM
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
  doNotDisturbStart?: string; // HH:MM
  doNotDisturbEnd?: string;
}

export type NotificationChannel = 'line' | 'telegram' | 'email' | 'phone' | 'watch' | 'app';

// ========================
// Butler Aggregate Document
// ========================

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

// ========================
// Firestore Collection Paths
// ========================

export const BUTLER_COLLECTIONS = {
  PROFILE: 'users/{uid}/butler/profile',
  HEALTH_DAILY: 'users/{uid}/butler/health/daily/{date}',
  TRANSACTIONS: 'users/{uid}/butler/finance/transactions',
  INVESTMENTS: 'users/{uid}/butler/finance/investments',
  INVESTMENT_TRADES: 'users/{uid}/butler/finance/investment_trades',
  LOANS: 'users/{uid}/butler/finance/loans',
  TAX_PROFILES: 'users/{uid}/butler/finance/tax',
  FUEL_LOGS: 'users/{uid}/butler/vehicles/{vehicleId}/fuel',
  MAINTENANCE: 'users/{uid}/butler/vehicles/{vehicleId}/maintenance',
  REMINDERS: 'users/{uid}/butler/reminders',
} as const;
