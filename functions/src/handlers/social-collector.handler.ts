/**
 * Social Collector Handler
 * 
 * HTTP endpoint triggered by Cloud Tasks to process a single collect job.
 */

import { Request, Response } from 'express';
import { processCollectJob } from '../services/social-collector.service';
import { CollectJob } from '../types/social.types';

export async function handleSocialCollector(req: Request, res: Response): Promise<void> {
    console.log('[Social Collector Handler] Triggered');

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

    } catch (error: any) {
        console.error('[Social Collector Handler] Error:', error);

        // Return 500 for retry, 400 for no-retry
        const isRetryable = error.code === 429 || error.code >= 500;
        res.status(isRetryable ? 500 : 400).json({
            success: false,
            error: error.message,
            retryable: isRetryable,
        });
    }
}
