"use strict";
/**
 * Fusion Engine Handler
 *
 * HTTP endpoint triggered by Cloud Scheduler to run fusion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFusionEngine = handleFusionEngine;
const fusion_engine_service_1 = require("../services/fusion-engine.service");
const error_handling_1 = require("../utils/error-handling");
async function handleFusionEngine(req, res) {
    console.log('[Fusion Engine Handler] Triggered');
    try {
        const result = await (0, fusion_engine_service_1.runFusionEngine)();
        res.status(200).json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('[Fusion Engine Handler] Error:', error);
        res.status(500).json({
            success: false,
            error: (0, error_handling_1.getErrorMessage)(error),
        });
    }
}
//# sourceMappingURL=fusion-engine.handler.js.map