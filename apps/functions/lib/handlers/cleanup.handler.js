"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCleanup = handleCleanup;
/**
 * Cleanup Handler - Scheduled function entry point
 */
const v2_1 = require("firebase-functions/v2");
const cleanup_service_1 = require("../services/cleanup.service");
/**
 * HTTP handler for cleanup (can also be triggered manually)
 */
async function handleCleanup(req, res) {
    const startTime = Date.now();
    try {
        v2_1.logger.info('[Cleanup Handler] Starting cleanup...');
        const results = await (0, cleanup_service_1.runAllCleanup)();
        const duration = Date.now() - startTime;
        res.status(200).json({
            success: true,
            duration,
            results,
        });
    }
    catch (error) {
        v2_1.logger.error('[Cleanup Handler] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
//# sourceMappingURL=cleanup.handler.js.map