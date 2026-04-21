import { MaterialCalculatorService } from '../services/material-calculator.service';

describe('MaterialCalculatorService', () => {
  describe('calculateStairVolume', () => {
    it('should correctly calculate volume for straight stairs', () => {
      const result = MaterialCalculatorService.calculateStairVolume({
        type: 'straight',
        diagonalLength: 5,
        width: 1.2,
        waistThickness: 0.15
      });
      // 5 * 1.2 * 0.15 = 0.9
      expect(result).toBeCloseTo(0.9);
    });

    it('should correctly calculate volume for spiral stairs', () => {
      const result = MaterialCalculatorService.calculateStairVolume({
        type: 'spiral',
        radius: 2,
        rotationAngle: 180,
        waistThickness: 0.2
      });
      // pi * 4 * (180/360) * 0.2 = pi * 4 * 0.5 * 0.2 = pi * 0.4 ≈ 1.2566
      expect(result).toBeCloseTo(Math.PI * 0.4);
    });

    it('should throw an error for missing straight stair parameters', () => {
      expect(() => {
        MaterialCalculatorService.calculateStairVolume({
          type: 'straight',
          diagonalLength: 5
        });
      }).toThrow('Missing parameters for straight stair calculation');
    });
  });

  describe('calculateScaffolding', () => {
    it('should calculate accurate scaffolding costs and areas', () => {
      const result = MaterialCalculatorService.calculateScaffolding(
        40, // perimeter
        3,  // floorHeight
        3,  // floors
        2,  // safetyNetLayers
        30  // rentalDays
      );

      // verticalArea = 40 * (3 * 3) = 360
      // horizontalArea = 40 * 40 * 0.25 = 400
      // rentalCost = 360 * 30 * 5 = 54000
      // installationCost = 360 * 150 = 54000
      // safetyNetCost = 400 * 2 * 20 = 16000
      // totalCost = 124000

      expect(result.verticalArea).toBe(360);
      expect(result.rentalCost).toBe(54000);
      expect(result.installationCost).toBe(54000);
      expect(result.safetyNetCost).toBe(16000);
      expect(result.totalCost).toBe(124000);
    });
  });

  describe('calculateCoating', () => {
    it('should calculate net and gross material requirements for waterproofing', () => {
      const result = MaterialCalculatorService.calculateCoating(
        'waterproof',
        'PU',
        100, // area
        2,   // layers
        10   // wastage percentage
      );

      // baseCoveragePerSqm = 1.5
      // net = 100 * 2 * 1.5 = 300
      // gross = 300 * 1.1 = 330
      
      expect(result.netRequirement).toBe(300);
      expect(result.grossRequirement).toBeCloseTo(330);
    });

    it('should throw an error for invalid material type', () => {
      expect(() => {
        MaterialCalculatorService.calculateCoating(
          'waterproof',
          'InvalidMaterial',
          100,
          2,
          10
        );
      }).toThrow('Invalid waterproof material: InvalidMaterial');
    });
  });
});
