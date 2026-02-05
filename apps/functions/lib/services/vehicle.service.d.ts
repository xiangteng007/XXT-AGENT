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
import { VehicleProfile, VehicleModification, FuelLog } from '../types/butler.types';
export declare const JIMNY_JB74_SPECS: {
    make: string;
    model: string;
    variant: string;
    engine: {
        code: string;
        displacement: number;
        power: number;
        torque: number;
        fuelType: "gasoline";
    };
    transmission: {
        type: "4-speed automatic";
        transferCase: string;
    };
    fuel: {
        tankCapacity: number;
        recommendedOctane: number;
        expectedMPG: {
            city: number;
            highway: number;
            combined: number;
        };
    };
    dimensions: {
        length: number;
        width: number;
        height: number;
        wheelbase: number;
        groundClearance: number;
    };
    maintenance: {
        oilChangeInterval: number;
        oilType: string;
        oilCapacity: number;
        tirePressure: {
            front: number;
            rear: number;
        };
    };
};
export declare const JIMNY_MODIFICATIONS: {
    suspension: string[];
    tires: string[];
    roofRack: string[];
    winch: string[];
    bumper: string[];
    lighting: string[];
};
export declare class VehicleService {
    /**
     * Initialize a Jimny JB74 profile
     */
    initializeJimny(uid: string, vehicleData: {
        licensePlate: string;
        year: number;
        purchaseDate: string;
        currentMileage: number;
        insuranceExpiry: string;
        inspectionExpiry: string;
    }): Promise<VehicleProfile>;
    /**
     * Get vehicle profile
     */
    getVehicle(uid: string, vehicleId: string): Promise<VehicleProfile | null>;
    /**
     * Record fuel log
     */
    recordFuel(uid: string, vehicleId: string, fuelData: {
        mileage: number;
        liters: number;
        pricePerLiter: number;
        station?: string;
        isFull: boolean;
    }): Promise<FuelLog>;
    /**
     * Get fuel consumption analysis
     */
    getFuelAnalysis(uid: string, vehicleId: string, months?: number): Promise<FuelAnalysis>;
    /**
     * Generate fuel efficiency tips
     */
    private generateFuelTips;
    /**
     * Add vehicle modification
     */
    addModification(uid: string, vehicleId: string, mod: Omit<VehicleModification, 'id'>): Promise<VehicleModification>;
    /**
     * Get all modifications
     */
    getModifications(uid: string, vehicleId: string): Promise<VehicleModification[]>;
    /**
     * Get maintenance schedule and due items
     */
    getMaintenanceSchedule(uid: string, vehicleId: string): Promise<MaintenanceReminder[]>;
    /**
     * Record maintenance/service
     */
    recordService(uid: string, vehicleId: string, service: {
        type: string;
        description: string;
        mileage: number;
        cost: number;
        shop?: string;
        notes?: string;
    }): Promise<void>;
    /**
     * Calculate days until date
     */
    private daysUntil;
    /**
     * Get vehicle dashboard summary
     */
    getDashboard(uid: string, vehicleId: string): Promise<VehicleDashboard>;
}
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
export declare const vehicleService: VehicleService;
//# sourceMappingURL=vehicle.service.d.ts.map