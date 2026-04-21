"use strict";
/**
 * Social Dispatcher Handler
 *
 * HTTP endpoint triggered by Cloud Scheduler to dispatch social collect jobs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSocialDispatcher = handleSocialDispatcher;
const v2_1 = require("firebase-functions/v2");
const social_dispatcher_service_1 = require("../services/social-dispatcher.service");
async function handleSocialDispatcher(req, res) {
    v2_1.logger.info('[Social Dispatcher Handler] Triggered');
    try {
        const result = await (0, social_dispatcher_service_1.dispatchSocialCollectJobs)();
        res.status(200).json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        v2_1.logger.error('[Social Dispatcher Handler] Error:', error);
        res.status(500).json({
            success: false,
            error: message,
        });
    }
}
//# sourceMappingURL=social-dispatcher.handler.js.map