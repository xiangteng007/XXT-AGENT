/**
 * Material Calculator Service
 * Implements engineering logic validation for Senteng ERP materials calculation.
 */

export type StairType = 'straight' | 'spiral' | 'cantilever';

export interface StairInput {
  type: StairType;
  diagonalLength?: number; // For straight
  riserHeight?: number; // For straight
  width?: number; // For straight
  waistThickness?: number; // For straight
  
  radius?: number; // For spiral
  rotationAngle?: number; // For spiral
  
  stepVolume?: number; // For cantilever
  numSteps?: number; // For cantilever
}

export const SCAFFOLDING_RATES = {
  rentalPerSqmPerDay: 5, // NTD
  installationPerSqm: 150, // NTD
  safetyNetPerSqm: 20 // NTD
};

export const WATERPROOF_MATERIALS = ['PU', 'Epoxy', 'Asphalt', 'Cement', 'Silicone'];
export const INSULATION_MATERIALS = ['EPS', 'XPS', 'Rockwool', 'Glasswool', 'PU Spray'];

export class MaterialCalculatorService {
  /**
   * Calculates concrete volume for stairs based on stair type.
   * Key Formula: Vol_slab = Area_slope * Thickness_waist
   */
  static calculateStairVolume(input: StairInput): number {
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
  static calculateScaffolding(
    perimeter: number,
    floorHeight: number,
    floors: number,
    safetyNetLayers: number,
    rentalDays: number
  ) {
    const totalHeight = floorHeight * floors;
    const verticalArea = perimeter * totalHeight;
    const horizontalArea = perimeter * perimeter * 0.25; // Roughly estimating floor area if square

    const rentalCost = verticalArea * rentalDays * SCAFFOLDING_RATES.rentalPerSqmPerDay;
    const installationCost = verticalArea * SCAFFOLDING_RATES.installationPerSqm;
    
    // Safety nets are typically applied horizontally per specific layers
    const safetyNetCost = horizontalArea * safetyNetLayers * SCAFFOLDING_RATES.safetyNetPerSqm;

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
  static calculateCoating(
    mode: 'waterproof' | 'insulation',
    material: string,
    area: number,
    layers: number,
    wastagePercentage: number
  ) {
    const validMaterials = mode === 'waterproof' ? WATERPROOF_MATERIALS : INSULATION_MATERIALS;
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
