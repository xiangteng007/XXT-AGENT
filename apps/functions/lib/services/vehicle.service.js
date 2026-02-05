"use strict";
/**
 * Vehicle Service
 *
 * Provides vehicle management capabilities for the personal butler:
 * - Focused on Suzuki Jimny JB74 specifications
 * - Fuel consumption tracking and analysis
 * - Maintenance scheduling and reminders
 * - Modification/upgrade logging
 * - Insurance and inspection expiry alerts
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
exports.vehicleService = exports.VehicleService = exports.JIMNY_MODIFICATIONS = exports.JIMNY_JB74_SPECS = void 0;
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// ================================
// Jimny JB74 Specifications
// ================================
exports.JIMNY_JB74_SPECS = {
    make: 'Suzuki',
    model: 'Jimny',
    variant: 'JB74',
    engine: {
        code: 'K15B',
        displacement: 1462, // cc
        power: 102, // hp @ 6000 rpm
        torque: 130, // Nm @ 4000 rpm
        fuelType: 'gasoline',
    },
    transmission: {
        type: '4-speed automatic',
        transferCase: 'AllGrip Pro part-time 4WD',
    },
    fuel: {
        tankCapacity: 40, // liters
        recommendedOctane: 92,
        expectedMPG: {
            city: 11, // km/L
            highway: 14,
            combined: 12.5,
        },
    },
    dimensions: {
        length: 3550,
        width: 1645,
        height: 1730,
        wheelbase: 2250,
        groundClearance: 210,
    },
    maintenance: {
        oilChangeInterval: 10000, // km or 6 months
        oilType: '5W-30',
        oilCapacity: 4.2, // liters
        tirePressure: {
            front: 26, // PSI
            rear: 26,
        },
    },
};
// Common Jimny modifications
exports.JIMNY_MODIFICATIONS = {
    suspension: ['ARB', 'OME', 'Ironman', 'Tough Dog'],
    tires: ['BF Goodrich KO2', 'Yokohama Geolandar', 'Toyo Open Country'],
    roofRack: ['Front Runner', 'Rhino Rack', 'Yakima'],
    winch: ['Warn', 'Smittybilt', 'Superwinch'],
    bumper: ['ARB', 'Steel Craft', 'Rival'],
    lighting: ['Rigid', 'Lightforce', 'Baja Designs'],
};
// ================================
// Vehicle Service Class
// ================================
class VehicleService {
    /**
     * Initialize a Jimny JB74 profile
     */
    async initializeJimny(uid, vehicleData) {
        const id = `vehicle_${Date.now()}`;
        const vehicle = {
            id,
            make: exports.JIMNY_JB74_SPECS.make,
            model: exports.JIMNY_JB74_SPECS.model,
            variant: exports.JIMNY_JB74_SPECS.variant,
            year: vehicleData.year,
            licensePlate: vehicleData.licensePlate,
            currentMileage: vehicleData.currentMileage,
            purchaseDate: vehicleData.purchaseDate,
            insuranceExpiry: vehicleData.insuranceExpiry,
            inspectionExpiry: vehicleData.inspectionExpiry,
            modifications: [],
            fuelLogs: [],
        };
        await db.doc(`users/${uid}/butler/vehicles/${id}`).set({
            ...vehicle,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        // Also update profile array
        await db.doc(`users/${uid}/butler/profile`).update({
            vehicles: admin.firestore.FieldValue.arrayUnion(vehicle),
            updatedAt: admin.firestore.Timestamp.now(),
        });
        return vehicle;
    }
    /**
     * Get vehicle profile
     */
    async getVehicle(uid, vehicleId) {
        const doc = await db.doc(`users/${uid}/butler/vehicles/${vehicleId}`).get();
        if (!doc.exists)
            return null;
        return doc.data();
    }
    /**
     * Record fuel log
     */
    async recordFuel(uid, vehicleId, fuelData) {
        const id = `fuel_${Date.now()}`;
        const date = new Date().toISOString().split('T')[0];
        const fuelLog = {
            id,
            date,
            mileage: fuelData.mileage,
            liters: fuelData.liters,
            pricePerLiter: fuelData.pricePerLiter,
            totalCost: Math.round(fuelData.liters * fuelData.pricePerLiter * 100) / 100,
            station: fuelData.station,
            isFull: fuelData.isFull,
        };
        // Save to fuel logs subcollection
        await db.doc(`users/${uid}/butler/vehicles/${vehicleId}/fuel/${id}`).set({
            ...fuelLog,
            createdAt: admin.firestore.Timestamp.now(),
        });
        // Update current mileage
        await db.doc(`users/${uid}/butler/vehicles/${vehicleId}`).update({
            currentMileage: fuelData.mileage,
            updatedAt: admin.firestore.Timestamp.now(),
        });
        return fuelLog;
    }
    /**
     * Get fuel consumption analysis
     */
    async getFuelAnalysis(uid, vehicleId, months = 6) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        const startDateStr = startDate.toISOString().split('T')[0];
        const snapshot = await db
            .collection(`users/${uid}/butler/vehicles/${vehicleId}/fuel`)
            .where('date', '>=', startDateStr)
            .orderBy('date', 'asc')
            .get();
        const logs = snapshot.docs.map(doc => doc.data());
        if (logs.length < 2) {
            return {
                period: `過去 ${months} 個月`,
                totalLiters: logs.reduce((sum, l) => sum + l.liters, 0),
                totalCost: logs.reduce((sum, l) => sum + l.totalCost, 0),
                averagePricePerLiter: 0,
                averageKmPerLiter: 0,
                recordCount: logs.length,
                comparison: 'insufficient_data',
            };
        }
        // Calculate km/L between full tank fills
        const fullTankLogs = logs.filter(l => l.isFull);
        let totalKm = 0;
        let totalLiters = 0;
        for (let i = 1; i < fullTankLogs.length; i++) {
            totalKm += fullTankLogs[i].mileage - fullTankLogs[i - 1].mileage;
            totalLiters += fullTankLogs[i].liters;
        }
        const avgKmPerLiter = totalLiters > 0 ? Math.round((totalKm / totalLiters) * 100) / 100 : 0;
        const totalCostAll = logs.reduce((sum, l) => sum + l.totalCost, 0);
        const totalLitersAll = logs.reduce((sum, l) => sum + l.liters, 0);
        // Compare to expected
        const expectedKmPerLiter = exports.JIMNY_JB74_SPECS.fuel.expectedMPG.combined;
        let comparison;
        if (avgKmPerLiter >= expectedKmPerLiter * 1.1) {
            comparison = 'better';
        }
        else if (avgKmPerLiter <= expectedKmPerLiter * 0.9) {
            comparison = 'worse';
        }
        else {
            comparison = 'expected';
        }
        return {
            period: `過去 ${months} 個月`,
            totalLiters: Math.round(totalLitersAll * 100) / 100,
            totalCost: Math.round(totalCostAll),
            averagePricePerLiter: Math.round((totalCostAll / totalLitersAll) * 100) / 100,
            averageKmPerLiter: avgKmPerLiter,
            expectedKmPerLiter: expectedKmPerLiter,
            recordCount: logs.length,
            comparison,
            tips: this.generateFuelTips(avgKmPerLiter, expectedKmPerLiter),
        };
    }
    /**
     * Generate fuel efficiency tips
     */
    generateFuelTips(actual, expected) {
        const tips = [];
        if (actual < expected * 0.9) {
            tips.push('油耗偏高，建議檢查輪胎氣壓是否正常 (建議 26 PSI)');
            tips.push('考慮減少急加速/急煞車的駕駛習慣');
            tips.push('檢查空氣濾清器是否需要更換');
            tips.push('若經常市區低速行駛，油耗較高屬正常現象');
        }
        else if (actual >= expected * 1.1) {
            tips.push('油耗表現優於預期！繼續保持良好的駕駛習慣');
        }
        else {
            tips.push('油耗表現正常');
        }
        return tips;
    }
    /**
     * Add vehicle modification
     */
    async addModification(uid, vehicleId, mod) {
        const id = `mod_${Date.now()}`;
        const modification = { id, ...mod };
        await db.doc(`users/${uid}/butler/vehicles/${vehicleId}/modifications/${id}`).set({
            ...modification,
            createdAt: admin.firestore.Timestamp.now(),
        });
        return modification;
    }
    /**
     * Get all modifications
     */
    async getModifications(uid, vehicleId) {
        const snapshot = await db
            .collection(`users/${uid}/butler/vehicles/${vehicleId}/modifications`)
            .orderBy('installedDate', 'desc')
            .get();
        return snapshot.docs.map(doc => doc.data());
    }
    /**
     * Get maintenance schedule and due items
     */
    async getMaintenanceSchedule(uid, vehicleId) {
        const vehicle = await this.getVehicle(uid, vehicleId);
        if (!vehicle)
            return [];
        const reminders = [];
        const today = new Date();
        // Check insurance expiry
        if (vehicle.insuranceExpiry) {
            const daysUntil = this.daysUntil(vehicle.insuranceExpiry);
            if (daysUntil <= 30) {
                reminders.push({
                    type: 'insurance',
                    title: '汽車保險即將到期',
                    dueDate: vehicle.insuranceExpiry,
                    daysUntil,
                    priority: daysUntil <= 7 ? 'high' : 'medium',
                    action: '請聯繫保險公司續保',
                });
            }
        }
        // Check inspection expiry
        if (vehicle.inspectionExpiry) {
            const daysUntil = this.daysUntil(vehicle.inspectionExpiry);
            if (daysUntil <= 30) {
                reminders.push({
                    type: 'inspection',
                    title: '驗車日期即將到期',
                    dueDate: vehicle.inspectionExpiry,
                    daysUntil,
                    priority: daysUntil <= 7 ? 'high' : 'medium',
                    action: '請預約監理站驗車',
                });
            }
        }
        // Check oil change (every 10,000 km or 6 months)
        const lastService = vehicle.lastServiceDate;
        const lastServiceMileage = vehicle.lastServiceMileage || 0;
        const mileageSinceService = vehicle.currentMileage - lastServiceMileage;
        if (mileageSinceService >= exports.JIMNY_JB74_SPECS.maintenance.oilChangeInterval * 0.9) {
            reminders.push({
                type: 'oil_change',
                title: '建議更換機油',
                dueMileage: lastServiceMileage + exports.JIMNY_JB74_SPECS.maintenance.oilChangeInterval,
                currentMileage: vehicle.currentMileage,
                priority: mileageSinceService >= exports.JIMNY_JB74_SPECS.maintenance.oilChangeInterval ? 'high' : 'medium',
                action: `使用 ${exports.JIMNY_JB74_SPECS.maintenance.oilType}，容量 ${exports.JIMNY_JB74_SPECS.maintenance.oilCapacity}L`,
            });
        }
        // Check if last service was more than 6 months ago
        if (lastService) {
            const lastServiceDate = new Date(lastService);
            const monthsSince = (today.getTime() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsSince >= 5.5) {
                reminders.push({
                    type: 'scheduled_service',
                    title: '定期保養時間已到',
                    lastServiceDate: lastService,
                    monthsSince: Math.round(monthsSince * 10) / 10,
                    priority: monthsSince >= 6 ? 'high' : 'medium',
                    action: '建議進行定期保養檢查',
                });
            }
        }
        // Sort by priority
        return reminders.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }
    /**
     * Record maintenance/service
     */
    async recordService(uid, vehicleId, service) {
        const id = `service_${Date.now()}`;
        const date = new Date().toISOString().split('T')[0];
        await db.doc(`users/${uid}/butler/vehicles/${vehicleId}/maintenance/${id}`).set({
            id,
            date,
            ...service,
            createdAt: admin.firestore.Timestamp.now(),
        });
        // Update vehicle last service info
        await db.doc(`users/${uid}/butler/vehicles/${vehicleId}`).update({
            lastServiceDate: date,
            lastServiceMileage: service.mileage,
            currentMileage: service.mileage,
            updatedAt: admin.firestore.Timestamp.now(),
        });
    }
    /**
     * Calculate days until date
     */
    daysUntil(dateStr) {
        const target = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    /**
     * Get vehicle dashboard summary
     */
    async getDashboard(uid, vehicleId) {
        const [vehicle, fuelAnalysis, reminders, modifications] = await Promise.all([
            this.getVehicle(uid, vehicleId),
            this.getFuelAnalysis(uid, vehicleId, 3),
            this.getMaintenanceSchedule(uid, vehicleId),
            this.getModifications(uid, vehicleId),
        ]);
        if (!vehicle) {
            throw new Error('Vehicle not found');
        }
        return {
            vehicle: {
                make: vehicle.make,
                model: vehicle.model,
                variant: vehicle.variant,
                year: vehicle.year,
                licensePlate: vehicle.licensePlate,
                currentMileage: vehicle.currentMileage,
            },
            fuelSummary: {
                avgKmPerLiter: fuelAnalysis.averageKmPerLiter,
                recentTotalCost: fuelAnalysis.totalCost,
                comparison: fuelAnalysis.comparison,
            },
            urgentReminders: reminders.filter(r => r.priority === 'high'),
            upcomingReminders: reminders.filter(r => r.priority !== 'high').slice(0, 3),
            modificationCount: modifications.length,
        };
    }
}
exports.VehicleService = VehicleService;
exports.vehicleService = new VehicleService();
//# sourceMappingURL=vehicle.service.js.map