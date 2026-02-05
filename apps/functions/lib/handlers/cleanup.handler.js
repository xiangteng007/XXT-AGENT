"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCleanup = handleCleanup;
const cleanup_service_1 = require("../services/cleanup.service");
/**
 * HTTP handler for cleanup (can also be triggered manually)
 */
async function handleCleanup(req, res) {
    const startTime = Date.now();
    try {
        console.log('[Cleanup Handler] Starting cleanup...');
        const results = await (0, cleanup_service_1.runAllCleanup)();
        const duration = Date.now() - startTime;
        res.status(200).json({
            success: true,
            duration,
            results,
        });
    }
    catch (error) {
        console.error('[Cleanup Handler] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
//# sourceMappingURL=cleanup.handler.js.map