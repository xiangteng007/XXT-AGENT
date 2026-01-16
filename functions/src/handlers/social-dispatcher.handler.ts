/**
 * Social Dispatcher Handler
 * 
 * HTTP endpoint triggered by Cloud Scheduler to dispatch social collect jobs.
 */

import { Request, Response } from 'express';
import { dispatchSocialCollectJobs } from '../services/social-dispatcher.service';

export async function handleSocialDispatcher(req: Request, res: Response): Promise<void> {
    console.log('[Social Dispatcher Handler] Triggered');

    try {
        const result = await dispatchSocialCollectJobs();

        res.status(200).json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('[Social Dispatcher Handler] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
