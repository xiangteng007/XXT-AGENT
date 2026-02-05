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

import * as admin from 'firebase-admin';
import {
    VehicleProfile,
    VehicleModification,
    FuelLog,
} from '../types/butler.types';

const db = admin.firestore();

// ================================
// Jimny JB74 Specifications
// ================================

export const JIMNY_JB74_SPECS = {
    make: 'Suzuki',
    model: 'Jimny',
    variant: 'JB74',
    engine: {
        code: 'K15B',
        displacement: 1462, // cc
        power: 102, // hp @ 6000 rpm
        torque: 130, // Nm @ 4000 rpm
        fuelType: 'gasoline' as const,
    },
    transmission: {
        type: '4-speed automatic' as const,
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
export const JIMNY_MODIFICATIONS = {
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

export class VehicleService {
    /**
     * Initialize a Jimny JB74 profile
     */
    async initializeJimny(
        uid: string,
        vehicleData: {
            licensePlate: string;
            year: number;
            purchaseDate: string;
            currentMileage: number;
            insuranceExpiry: string;
            inspectionExpiry: string;
        }
    ): Promise<VehicleProfile> {
        const id = `vehicle_${Date.now()}`;
        
        const vehicle: VehicleProfile = {
            id,
            make: JIMNY_JB74_SPECS.make,
            model: JIMNY_JB74_SPECS.model,
            variant: JIMNY_JB74_SPECS.variant,
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
    async getVehicle(uid: string, vehicleId: string): Promise<VehicleProfile | null> {
        const doc = await db.doc(`users/${uid}/butler/vehicles/${vehicleId}`).get();
        if (!doc.exists) return null;
        return doc.data() as VehicleProfile;
    }

    /**
     * Record fuel log
     */
    async recordFuel(
        uid: string,
        vehicleId: string,
        fuelData: {
            mileage: number;
            liters: number;
            pricePerLiter: number;
            station?: string;
            isFull: boolean;
        }
    ): Promise<FuelLog> {
        const id = `fuel_${Date.now()}`;
        const date = new Date().toISOString().split('T')[0];
        
        const fuelLog: FuelLog = {
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
    async getFuelAnalysis(uid: string, vehicleId: string, months: number = 6): Promise<FuelAnalysis> {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const snapshot = await db
            .collection(`users/${uid}/butler/vehicles/${vehicleId}/fuel`)
            .where('date', '>=', startDateStr)
            .orderBy('date', 'asc')
            .get();
        
        const logs = snapshot.docs.map(doc => doc.data() as FuelLog);
        
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
        const expectedKmPerLiter = JIMNY_JB74_SPECS.fuel.expectedMPG.combined;
        let comparison: 'better' | 'worse' | 'expected' | 'insufficient_data';
        if (avgKmPerLiter >= expectedKmPerLiter * 1.1) {
            comparison = 'better';
        } else if (avgKmPerLiter <= expectedKmPerLiter * 0.9) {
            comparison = 'worse';
        } else {
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
    private generateFuelTips(actual: number, expected: number): string[] {
        const tips: string[] = [];
        
        if (actual < expected * 0.9) {
            tips.push('油耗偏高，建議檢查輪胎氣壓是否正常 (建議 26 PSI)');
            tips.push('考慮減少急加速/急煞車的駕駛習慣');
            tips.push('檢查空氣濾清器是否需要更換');
            tips.push('若經常市區低速行駛，油耗較高屬正常現象');
        } else if (actual >= expected * 1.1) {
            tips.push('油耗表現優於預期！繼續保持良好的駕駛習慣');
        } else {
            tips.push('油耗表現正常');
        }
        
        return tips;
    }

    /**
     * Add vehicle modification
     */
    async addModification(
        uid: string,
        vehicleId: string,
        mod: Omit<VehicleModification, 'id'>
    ): Promise<VehicleModification> {
        const id = `mod_${Date.now()}`;
        const modification: VehicleModification = { id, ...mod };
        
        await db.doc(`users/${uid}/butler/vehicles/${vehicleId}/modifications/${id}`).set({
            ...modification,
            createdAt: admin.firestore.Timestamp.now(),
        });
        
        return modification;
    }

    /**
     * Get all modifications
     */
    async getModifications(uid: string, vehicleId: string): Promise<VehicleModification[]> {
        const snapshot = await db
            .collection(`users/${uid}/butler/vehicles/${vehicleId}/modifications`)
            .orderBy('installedDate', 'desc')
            .get();
        
        return snapshot.docs.map(doc => doc.data() as VehicleModification);
    }

    /**
     * Get maintenance schedule and due items
     */
    async getMaintenanceSchedule(uid: string, vehicleId: string): Promise<MaintenanceReminder[]> {
        const vehicle = await this.getVehicle(uid, vehicleId);
        if (!vehicle) return [];
        
        const reminders: MaintenanceReminder[] = [];
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
        
        if (mileageSinceService >= JIMNY_JB74_SPECS.maintenance.oilChangeInterval * 0.9) {
            reminders.push({
                type: 'oil_change',
                title: '建議更換機油',
                dueMileage: lastServiceMileage + JIMNY_JB74_SPECS.maintenance.oilChangeInterval,
                currentMileage: vehicle.currentMileage,
                priority: mileageSinceService >= JIMNY_JB74_SPECS.maintenance.oilChangeInterval ? 'high' : 'medium',
                action: `使用 ${JIMNY_JB74_SPECS.maintenance.oilType}，容量 ${JIMNY_JB74_SPECS.maintenance.oilCapacity}L`,
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
    async recordService(
        uid: string,
        vehicleId: string,
        service: {
            type: string;
            description: string;
            mileage: number;
            cost: number;
            shop?: string;
            notes?: string;
        }
    ): Promise<void> {
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
    private daysUntil(dateStr: string): number {
        const target = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    /**
     * Get vehicle dashboard summary
     */
    async getDashboard(uid: string, vehicleId: string): Promise<VehicleDashboard> {
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

// ================================
// Types
// ================================

export interface FuelAnalysis {
    period: string;
    totalLiters: number;
    totalCost: number;
    averagePricePerLiter: number;
    averageKmPerLiter: number;
    expectedKmPerLiter?: number;
    recordCount: number;
    comparison: 'better' | 'worse' | 'expected' | 'insufficient_data';
    tips?: string[];
}

export interface MaintenanceReminder {
    type: string;
    title: string;
    dueDate?: string;
    dueMileage?: number;
    currentMileage?: number;
    lastServiceDate?: string;
    monthsSince?: number;
    daysUntil?: number;
    priority: 'high' | 'medium' | 'low';
    action: string;
}

export interface VehicleDashboard {
    vehicle: {
        make: string;
        model: string;
        variant: string;
        year: number;
        licensePlate: string;
        currentMileage: number;
    };
    fuelSummary: {
        avgKmPerLiter: number;
        recentTotalCost: number;
        comparison: string;
    };
    urgentReminders: MaintenanceReminder[];
    upcomingReminders: MaintenanceReminder[];
    modificationCount: number;
}

export const vehicleService = new VehicleService();
