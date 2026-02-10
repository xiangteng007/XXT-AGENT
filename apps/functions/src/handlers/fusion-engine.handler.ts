/**
 * Fusion Engine Handler
 * 
 * HTTP endpoint triggered by Cloud Scheduler to run fusion.
 */

import { logger } from 'firebase-functions/v2';
import { Request, Response } from 'express';
import { runFusionEngine } from '../services/fusion-engine.service';
import { getErrorMessage } from '../utils/error-handling';

export async function handleFusionEngine(req: Request, res: Response): Promise<void> {
    logger.info('[Fusion Engine Handler] Triggered');

    try {
        const result = await runFusionEngine();

        res.status(200).json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });

    } catch (error: unknown) {
        logger.error('[Fusion Engine Handler] Error:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error),
        });
    }
}
