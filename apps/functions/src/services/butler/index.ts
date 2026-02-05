/**
 * Butler Services Index
 * 
 * Exports all Personal Butler System services for unified access.
 */

// Core Services
export { ButlerService, butlerService } from '../butler.service';
export { HealthService, healthService, HEALTH_CONSTANTS } from '../health.service';
export { GarminConnectAdapter, garminAdapter, processAppleHealthSync } from '../health-integrations.service';
export type { AppleHealthPayload } from '../health-integrations.service';

// Finance
export { FinanceService, financeService, TAIWAN_BANKS, TRANSACTION_CATEGORIES } from '../finance.service';
export type { MonthlySummary, BillReminder, SpendingInsights } from '../finance.service';
export { TaiwanOpenBankingAdapter, openBankingAdapter } from '../open-banking.adapter';
export type { AccountBalance } from '../open-banking.adapter';

// Vehicle
export { VehicleService, vehicleService, JIMNY_JB74_SPECS, JIMNY_MODIFICATIONS } from '../vehicle.service';
export type { FuelAnalysis, MaintenanceReminder, VehicleDashboard } from '../vehicle.service';

// Schedule
export { ScheduleService, scheduleService } from '../schedule.service';
export type { 
    CalendarEvent, 
    EventCategory, 
    RecurrenceRule, 
    Reminder, 
    DailySchedule, 
    TimeSlot,
    ReminderNotification,
    WeekOverview 
} from '../schedule.service';

// Business
export { BusinessService, businessService } from '../business.service';
export type { 
    DesignProject, 
    ProjectType, 
    ProjectStatus, 
    ProjectPhase, 
    Client, 
    BusinessMetrics,
    ProjectTimelineItem,
    BusinessDashboard 
} from '../business.service';
