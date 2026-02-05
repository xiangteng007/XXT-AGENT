/**
 * Market Streamer Handler
 * 
 * HTTP endpoint triggered by Cloud Scheduler every minute.
 */

import { Request, Response } from 'express';
import { runMarketStreamer } from '../services/market-streamer.service';
import { getErrorMessage } from '../utils/error-handling';

export async function handleMarketStreamer(req: Request, res: Response): Promise<void> {
    console.log('[Market Streamer Handler] Triggered');

    try {
        const result = await runMarketStreamer();

        res.status(200).json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });

    } catch (error: unknown) {
        console.error('[Market Streamer Handler] Error:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error),
        });
    }
}
