/**
 * Material Calculator Service
 * Implements engineering logic validation for Senteng ERP materials calculation.
 */
export type StairType = 'straight' | 'spiral' | 'cantilever';
export interface StairInput {
    type: StairType;
    diagonalLength?: number;
    riserHeight?: number;
    width?: number;
    waistThickness?: number;
    radius?: number;
    rotationAngle?: number;
    stepVolume?: number;
    numSteps?: number;
}
export declare const SCAFFOLDING_RATES: {
    rentalPerSqmPerDay: number;
    installationPerSqm: number;
    safetyNetPerSqm: number;
};
export declare const WATERPROOF_MATERIALS: string[];
export declare const INSULATION_MATERIALS: string[];
export declare class MaterialCalculatorService {
    /**
     * Calculates concrete volume for stairs based on stair type.
     * Key Formula: Vol_slab = Area_slope * Thickness_waist
     */
    static calculateStairVolume(input: StairInput): number;
    /**
     * Calculates scaffolding costs and required areas.
     */
    static calculateScaffolding(perimeter: number, floorHeight: number, floors: number, safetyNetLayers: number, rentalDays: number): {
        verticalArea: number;
        rentalCost: number;
        installationCost: number;
        safetyNetCost: number;
        totalCost: number;
    };
    /**
     * Calculates required material volume for waterproofing and insulation.
     */
    static calculateCoating(mode: 'waterproof' | 'insulation', material: string, area: number, layers: number, wastagePercentage: number): {
        netRequirement: number;
        grossRequirement: number;
        unit: string;
    };
}
//# sourceMappingURL=material-calculator.service.d.ts.map