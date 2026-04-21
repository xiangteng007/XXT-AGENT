import { Request, Response } from 'express';
import { logger } from 'firebase-functions/v2';
import { MaterialCalculatorService } from '../services/material-calculator.service';

export const handleMaterialCalculator = async (req: Request, res: Response) => {
    // 允許 CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        const { action, payload } = req.body;

        if (!action || !payload) {
            res.status(400).json({ error: 'Missing action or payload' });
            return;
        }

        let result;

        switch (action) {
            case 'calculateStairVolume':
                result = MaterialCalculatorService.calculateStairVolume(payload);
                break;
            case 'calculateScaffolding':
                result = MaterialCalculatorService.calculateScaffolding(
                    payload.perimeter,
                    payload.floorHeight,
                    payload.floors,
                    payload.safetyNetLayers,
                    payload.rentalDays
                );
                break;
            case 'calculateCoating':
                result = MaterialCalculatorService.calculateCoating(
                    payload.mode,
                    payload.material,
                    payload.area,
                    payload.layers,
                    payload.wastagePercentage
                );
                break;
            default:
                res.status(400).json({ error: `Unsupported action: ${action}` });
                return;
        }

        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        logger.error('[Material Calculator Error]', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
