/**
 * Social Collector Handler
 * 
 * HTTP endpoint triggered by Cloud Tasks to process a single collect job.
 */

import { logger } from 'firebase-functions/v2';
import { Request, Response } from 'express';
import { processCollectJob } from '../services/social-collector.service';
import { CollectJob } from '../types/social.types';

export async function handleSocialCollector(req: Request, res: Response): Promise<void> {
    logger.info('[Social Collector Handler] Triggered');

    try {
        // Parse job from request body
        const job: CollectJob = req.body;

        if (!job.tenantId || !job.sourceId) {
            res.status(400).json({
                success: false,
                error: 'Invalid job: missing tenantId or sourceId',
            });
            return;
        }

        const result = await processCollectJob(job);

        res.status(200).json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });

    } catch (error: unknown) {
        logger.error('[Social Collector Handler] Error:', error);

        const message = error instanceof Error ? error.message : String(error);
        const errorCode = (error as { code?: number }).code;
        // Return 500 for retry, 400 for no-retry
        const isRetryable = errorCode === 429 || (errorCode !== undefined && errorCode >= 500);
        res.status(isRetryable ? 500 : 400).json({
            success: false,
            error: message,
            retryable: isRetryable,
        });
    }
}
