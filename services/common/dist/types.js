"use strict";
/**
 * FusedEvent Schema
 * Per SPEC_PHASE6_5_PHASE7_CLOUD.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FusedEventSchema = exports.ActionSchema = exports.EvidenceSchema = exports.InstrumentSchema = void 0;
exports.getSeverityLabel = getSeverityLabel;
const zod_1 = require("zod");
// Instrument schema
exports.InstrumentSchema = zod_1.z.object({
    type: zod_1.z.enum(['stock', 'future', 'fund', 'fx', 'crypto']),
    symbol: zod_1.z.string(),
    name: zod_1.z.string().optional(),
});
// Evidence schema
exports.EvidenceSchema = zod_1.z.object({
    source: zod_1.z.enum(['market', 'news', 'social']),
    title: zod_1.z.string(),
    url: zod_1.z.string().optional(),
    ts: zod_1.z.string(),
    platform: zod_1.z.string().optional(),
    postId: zod_1.z.string().optional(),
});
// Action schema
exports.ActionSchema = zod_1.z.object({
    type: zod_1.z.enum(['watch', 'buy', 'sell', 'hold', 'alert']),
    reason: zod_1.z.string(),
});
// FusedEvent schema (must contain news_title + severity)
exports.FusedEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    ts: zod_1.z.string(),
    instrument: exports.InstrumentSchema.optional(),
    news_title: zod_1.z.string(), // REQUIRED: Per spec
    severity: zod_1.z.number().min(1).max(10), // REQUIRED: Per spec (1-10)
    event_type: zod_1.z.enum(['market', 'news', 'social', 'fusion']),
    sentiment: zod_1.z.enum(['bullish', 'bearish', 'neutral', 'unknown']),
    impact_hypothesis: zod_1.z.array(zod_1.z.string()),
    evidence: zod_1.z.array(exports.EvidenceSchema),
    confidence: zod_1.z.number().min(0).max(1),
    actions: zod_1.z.array(exports.ActionSchema),
    keywords: zod_1.z.array(zod_1.z.string()).optional(),
    location: zod_1.z.string().optional(),
});
/**
 * Severity mapping (1-10)
 * 1-3: Noise/general volatility
 * 4-6: Observable event (may affect short-term)
 * 7-8: High risk/impact (should push)
 * 9-10: Critical event (force push + generate report)
 */
function getSeverityLabel(severity) {
    if (severity >= 9)
        return '🔴 CRITICAL';
    if (severity >= 7)
        return '🟠 HIGH';
    if (severity >= 4)
        return '🟡 MEDIUM';
    return '⚪ LOW';
}
