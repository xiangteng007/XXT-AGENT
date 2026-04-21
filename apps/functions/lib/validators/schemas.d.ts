/**
 * API Input Validation Schemas (#5)
 *
 * Zod schemas for validating request bodies and query params
 * across all Butler API handlers.
 */
import { z } from 'zod';
export declare const TransactionCreateSchema: z.ZodObject<{
    amount: z.ZodNumber;
    type: z.ZodEnum<{
        expense: "expense";
        income: "income";
    }>;
    category: z.ZodString;
    description: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    date: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    bankAccountId: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    source: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        manual: "manual";
        open_banking: "open_banking";
        notification: "notification";
    }>>>;
}, z.core.$strip>;
export declare const TransactionQuerySchema: z.ZodObject<{
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<{
        expense: "expense";
        income: "income";
    }>>;
    category: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const HealthMetricSchema: z.ZodObject<{
    type: z.ZodEnum<{
        weight: "weight";
        steps: "steps";
        sleep: "sleep";
        blood_pressure: "blood_pressure";
        heart_rate: "heart_rate";
        blood_sugar: "blood_sugar";
        water: "water";
    }>;
    value: z.ZodNumber;
    unit: z.ZodOptional<z.ZodString>;
    date: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AppleHealthSyncSchema: z.ZodObject<{
    metrics: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        value: z.ZodNumber;
        date: z.ZodString;
        unit: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const VehicleMaintenanceSchema: z.ZodObject<{
    type: z.ZodString;
    date: z.ZodString;
    mileage: z.ZodOptional<z.ZodNumber>;
    cost: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const FuelRecordSchema: z.ZodObject<{
    liters: z.ZodNumber;
    pricePerLiter: z.ZodNumber;
    totalCost: z.ZodOptional<z.ZodNumber>;
    mileage: z.ZodOptional<z.ZodNumber>;
    date: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const EventCreateSchema: z.ZodObject<{
    title: z.ZodString;
    start: z.ZodString;
    end: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    allDay: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare function validateBody<T>(schema: z.ZodType<T>, body: unknown): {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
};
//# sourceMappingURL=schemas.d.ts.map