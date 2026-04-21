"use strict";
/**
 * Fusion Engine Handler
 *
 * HTTP endpoint triggered by Cloud Scheduler to run fusion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFusionEngine = handleFusionEngine;
const v2_1 = require("firebase-functions/v2");
const fusion_engine_service_1 = require("../services/fusion-engine.service");
const error_handling_1 = require("../utils/error-handling");
const openclaw_emitter_service_1 = require("../services/openclaw-emitter.service");
async function handleFusionEngine(req, res) {
    v2_1.logger.info('[Fusion Engine Handler] Triggered');
    try {
        const result = await (0, fusion_engine_service_1.runFusionEngine)();
        // [OpenClaw] Notify Office (fire-and-forget)
        void openclaw_emitter_service_1.ocEmit.fusionPulse(crypto.randomUUID(), `Fusion complete: ${result.fused} fused, ${result.processed} processed`);
        res.status(200).json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        v2_1.logger.error('[Fusion Engine Handler] Error:', error);
        res.status(500).json({
            success: false,
            error: (0, error_handling_1.getErrorMessage)(error),
        });
    }
}
//# sourceMappingURL=fusion-engine.handler.js.map