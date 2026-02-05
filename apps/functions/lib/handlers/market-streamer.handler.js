"use strict";
/**
 * Market Streamer Handler
 *
 * HTTP endpoint triggered by Cloud Scheduler every minute.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMarketStreamer = handleMarketStreamer;
const market_streamer_service_1 = require("../services/market-streamer.service");
const error_handling_1 = require("../utils/error-handling");
async function handleMarketStreamer(req, res) {
    console.log('[Market Streamer Handler] Triggered');
    try {
        const result = await (0, market_streamer_service_1.runMarketStreamer)();
        res.status(200).json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('[Market Streamer Handler] Error:', error);
        res.status(500).json({
            success: false,
            error: (0, error_handling_1.getErrorMessage)(error),
        });
    }
}
//# sourceMappingURL=market-streamer.handler.js.map