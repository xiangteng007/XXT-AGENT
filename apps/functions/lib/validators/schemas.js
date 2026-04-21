"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventCreateSchema = exports.FuelRecordSchema = exports.VehicleMaintenanceSchema = exports.AppleHealthSyncSchema = exports.HealthMetricSchema = exports.TransactionQuerySchema = exports.TransactionCreateSchema = void 0;
exports.validateBody = validateBody;
/**
 * API Input Validation Schemas (#5)
 *
 * Zod schemas for validating request bodies and query params
 * across all Butler API handlers.
 */
const zod_1 = require("zod");
// ================================
// Finance
// ================================
exports.TransactionCreateSchema = zod_1.z.object({
    amount: zod_1.z.number().positive().max(100_000_000),
    type: zod_1.z.enum(['income', 'expense']),
    category: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional().default(''),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(() => new Date().toISOString().split('T')[0]),
    bankAccountId: zod_1.z.string().max(100).optional().default(''),
    source: zod_1.z.enum(['manual', 'open_banking', 'notification']).optional().default('manual'),
});
exports.TransactionQuerySchema = zod_1.z.object({
    startDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    type: zod_1.z.enum(['income', 'expense']).optional(),
    category: zod_1.z.string().max(100).optional(),
});
// ================================
// Health
// ================================
exports.HealthMetricSchema = zod_1.z.object({
    type: zod_1.z.enum(['weight', 'blood_pressure', 'heart_rate', 'blood_sugar', 'steps', 'sleep', 'water']),
    value: zod_1.z.number().positive().max(100_000),
    unit: zod_1.z.string().max(20).optional(),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
exports.AppleHealthSyncSchema = zod_1.z.object({
    metrics: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        value: zod_1.z.number(),
        date: zod_1.z.string(),
        unit: zod_1.z.string().optional(),
    })).max(1000),
});
// ================================
// Vehicle
// ================================
exports.VehicleMaintenanceSchema = zod_1.z.object({
    type: zod_1.z.string().min(1).max(100),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mileage: zod_1.z.number().int().positive().optional(),
    cost: zod_1.z.number().positive().optional(),
    notes: zod_1.z.string().max(500).optional(),
});
exports.FuelRecordSchema = zod_1.z.object({
    liters: zod_1.z.number().positive().max(200),
    pricePerLiter: zod_1.z.number().positive().max(100),
    totalCost: zod_1.z.number().positive().optional(),
    mileage: zod_1.z.number().int().positive().optional(),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
// ================================
// Schedule
// ================================
exports.EventCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    start: zod_1.z.string(), // ISO date-time
    end: zod_1.z.string().optional(),
    description: zod_1.z.string().max(1000).optional(),
    location: zod_1.z.string().max(200).optional(),
    allDay: zod_1.z.boolean().optional(),
});
// ================================
// Utility
// ================================
function validateBody(schema, body) {
    const result = schema.safeParse(body);
    if (result.success)
        return { success: true, data: result.data };
    const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    return { success: false, error: messages.join('; ') };
}
//# sourceMappingURL=schemas.js.map