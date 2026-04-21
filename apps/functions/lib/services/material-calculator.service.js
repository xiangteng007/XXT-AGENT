"use strict";
/**
 * Material Calculator Service
 * Implements engineering logic validation for Senteng ERP materials calculation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterialCalculatorService = exports.INSULATION_MATERIALS = exports.WATERPROOF_MATERIALS = exports.SCAFFOLDING_RATES = void 0;
exports.SCAFFOLDING_RATES = {
    rentalPerSqmPerDay: 5, // NTD
    installationPerSqm: 150, // NTD
    safetyNetPerSqm: 20 // NTD
};
exports.WATERPROOF_MATERIALS = ['PU', 'Epoxy', 'Asphalt', 'Cement', 'Silicone'];
exports.INSULATION_MATERIALS = ['EPS', 'XPS', 'Rockwool', 'Glasswool', 'PU Spray'];
class MaterialCalculatorService {
    /**
     * Calculates concrete volume for stairs based on stair type.
     * Key Formula: Vol_slab = Area_slope * Thickness_waist
     */
    static calculateStairVolume(input) {
        switch (input.type) {
            case 'straight': {
                if (!input.diagonalLength || !input.width || !input.waistThickness) {
                    throw new Error('Missing parameters for straight stair calculation');
                }
                const areaSlope = input.diagonalLength * input.width;
                return areaSlope * input.waistThickness;
            }
            case 'spiral': {
                if (!input.radius || !input.rotationAngle || !input.waistThickness) {
                    throw new Error('Missing parameters for spiral stair calculation');
                }
                // Approximate area of the spiral slope: (pi * r^2 * (angle / 360))
                const areaSlope = Math.PI * Math.pow(input.radius, 2) * (input.rotationAngle / 360);
                return areaSlope * input.waistThickness;
            }
            case 'cantilever': {
                if (!input.stepVolume || !input.numSteps) {
                    throw new Error('Missing parameters for cantilever stair calculation');
                }
                return input.stepVolume * input.numSteps;
            }
            default:
                throw new Error(`Unsupported stair type: ${input.type}`);
        }
    }
    /**
     * Calculates scaffolding costs and required areas.
     */
    static calculateScaffolding(perimeter, floorHeight, floors, safetyNetLayers, rentalDays) {
        const totalHeight = floorHeight * floors;
        const verticalArea = perimeter * totalHeight;
        const horizontalArea = perimeter * perimeter * 0.25; // Roughly estimating floor area if square
        const rentalCost = verticalArea * rentalDays * exports.SCAFFOLDING_RATES.rentalPerSqmPerDay;
        const installationCost = verticalArea * exports.SCAFFOLDING_RATES.installationPerSqm;
        // Safety nets are typically applied horizontally per specific layers
        const safetyNetCost = horizontalArea * safetyNetLayers * exports.SCAFFOLDING_RATES.safetyNetPerSqm;
        return {
            verticalArea,
            rentalCost,
            installationCost,
            safetyNetCost,
            totalCost: rentalCost + installationCost + safetyNetCost
        };
    }
    /**
     * Calculates required material volume for waterproofing and insulation.
     */
    static calculateCoating(mode, material, area, layers, wastagePercentage) {
        const validMaterials = mode === 'waterproof' ? exports.WATERPROOF_MATERIALS : exports.INSULATION_MATERIALS;
        if (!validMaterials.includes(material)) {
            throw new Error(`Invalid ${mode} material: ${material}`);
        }
        // Assuming a standard coverage of 1.5 kg / sqm / layer for demonstration
        const baseCoveragePerSqm = 1.5;
        const netRequirement = area * layers * baseCoveragePerSqm;
        const wastageFactor = 1 + (wastagePercentage / 100);
        const grossRequirement = netRequirement * wastageFactor;
        return {
            netRequirement,
            grossRequirement,
            unit: 'kg'
        };
    }
}
exports.MaterialCalculatorService = MaterialCalculatorService;
//# sourceMappingURL=material-calculator.service.js.map