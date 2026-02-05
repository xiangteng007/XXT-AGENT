/**
 * Fusion Engine Handler
 * 
 * HTTP endpoint triggered by Cloud Scheduler to run fusion.
 */

import { Request, Response } from 'express';
import { runFusionEngine } from '../services/fusion-engine.service';
import { getErrorMessage } from '../utils/error-handling';

export async function handleFusionEngine(req: Request, res: Response): Promise<void> {
    console.log('[Fusion Engine Handler] Triggered');

    try {
        const result = await runFusionEngine();

        res.status(200).json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });

    } catch (error: unknown) {
        console.error('[Fusion Engine Handler] Error:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error),
        });
    }
}
