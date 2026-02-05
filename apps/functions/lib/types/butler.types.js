"use strict";
/**
 * XXT-AGENT Personal Butler System Types
 *
 * Defines the data models for the personal butler/secretary functionality.
 * These types map to Firestore collections under users/{uid}/butler/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUTLER_COLLECTIONS = void 0;
// ========================
// Firestore Collection Paths
// ========================
exports.BUTLER_COLLECTIONS = {
    PROFILE: 'users/{uid}/butler/profile',
    HEALTH_DAILY: 'users/{uid}/butler/health/daily/{date}',
    TRANSACTIONS: 'users/{uid}/butler/finance/transactions',
    FUEL_LOGS: 'users/{uid}/butler/vehicles/{vehicleId}/fuel',
    MAINTENANCE: 'users/{uid}/butler/vehicles/{vehicleId}/maintenance',
    REMINDERS: 'users/{uid}/butler/reminders',
};
//# sourceMappingURL=butler.types.js.map