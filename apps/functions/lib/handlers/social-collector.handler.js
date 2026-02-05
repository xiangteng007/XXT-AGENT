"use strict";
/**
 * Social Collector Handler
 *
 * HTTP endpoint triggered by Cloud Tasks to process a single collect job.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSocialCollector = handleSocialCollector;
const social_collector_service_1 = require("../services/social-collector.service");
async function handleSocialCollector(req, res) {
    console.log('[Social Collector Handler] Triggered');
    try {
        // Parse job from request body
        const job = req.body;
        if (!job.tenantId || !job.sourceId) {
            res.status(400).json({
                success: false,
                error: 'Invalid job: missing tenantId or sourceId',
            });
            return;
        }
        const result = await (0, social_collector_service_1.processCollectJob)(job);
        res.status(200).json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('[Social Collector Handler] Error:', error);
        const message = error instanceof Error ? error.message : String(error);
        const errorCode = error.code;
        // Return 500 for retry, 400 for no-retry
        const isRetryable = errorCode === 429 || (errorCode !== undefined && errorCode >= 500);
        res.status(isRetryable ? 500 : 400).json({
            success: false,
            error: message,
            retryable: isRetryable,
        });
    }
}
//# sourceMappingURL=social-collector.handler.js.map