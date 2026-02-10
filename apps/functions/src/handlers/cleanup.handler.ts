/**
 * Cleanup Handler - Scheduled function entry point
 */
import { logger } from 'firebase-functions/v2';
import { Request, Response } from 'express';
import { runAllCleanup } from '../services/cleanup.service';

/**
 * HTTP handler for cleanup (can also be triggered manually)
 */
export async function handleCleanup(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
        logger.info('[Cleanup Handler] Starting cleanup...');

        const results = await runAllCleanup();

        const duration = Date.now() - startTime;

        res.status(200).json({
            success: true,
            duration,
            results,
        });

    } catch (error) {
        logger.error('[Cleanup Handler] Error:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message,
        });
    }
}
