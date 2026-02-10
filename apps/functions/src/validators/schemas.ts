/**
 * API Input Validation Schemas (#5)
 * 
 * Zod schemas for validating request bodies and query params
 * across all Butler API handlers.
 */
import { z } from 'zod';

// ================================
// Finance
// ================================
export const TransactionCreateSchema = z.object({
    amount: z.number().positive().max(100_000_000),
    type: z.enum(['income', 'expense']),
    category: z.string().min(1).max(100),
    description: z.string().max(500).optional().default(''),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(() => new Date().toISOString().split('T')[0]),
    bankAccountId: z.string().max(100).optional().default(''),
    source: z.enum(['manual', 'open_banking', 'notification']).optional().default('manual'),
});

export const TransactionQuerySchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    type: z.enum(['income', 'expense']).optional(),
    category: z.string().max(100).optional(),
});

// ================================
// Health
// ================================
export const HealthMetricSchema = z.object({
    type: z.enum(['weight', 'blood_pressure', 'heart_rate', 'blood_sugar', 'steps', 'sleep', 'water']),
    value: z.number().positive().max(100_000),
    unit: z.string().max(20).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const AppleHealthSyncSchema = z.object({
    metrics: z.array(z.object({
        type: z.string(),
        value: z.number(),
        date: z.string(),
        unit: z.string().optional(),
    })).max(1000),
});

// ================================
// Vehicle
// ================================
export const VehicleMaintenanceSchema = z.object({
    type: z.string().min(1).max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mileage: z.number().int().positive().optional(),
    cost: z.number().positive().optional(),
    notes: z.string().max(500).optional(),
});

export const FuelRecordSchema = z.object({
    liters: z.number().positive().max(200),
    pricePerLiter: z.number().positive().max(100),
    totalCost: z.number().positive().optional(),
    mileage: z.number().int().positive().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ================================
// Schedule
// ================================
export const EventCreateSchema = z.object({
    title: z.string().min(1).max(200),
    start: z.string(), // ISO date-time
    end: z.string().optional(),
    description: z.string().max(1000).optional(),
    location: z.string().max(200).optional(),
    allDay: z.boolean().optional(),
});

// ================================
// Utility
// ================================
export function validateBody<T>(schema: z.ZodType<T>, body: unknown): 
    { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(body);
    if (result.success) return { success: true, data: result.data };
    const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    return { success: false, error: messages.join('; ') };
}
