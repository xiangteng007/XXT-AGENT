"use strict";
/**
 * FusedEvent Schema v2.0
 * Enhanced with explainable severity scores
 *
 * Per XXT-AGENT Production-Grade Upgrade Plan
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FusedEventSchema = exports.FusedEventSchemaV2 = exports.MarketSourceSchema = exports.SocialSourceSchema = exports.NewsSourceSchema = exports.SeverityBreakdownSchema = exports.SeverityScoresSchema = exports.ActionSchema = exports.EvidenceSchema = exports.InstrumentSchema = void 0;
exports.getSeverityLabel = getSeverityLabel;
exports.calculateSeverity = calculateSeverity;
exports.createSeverityBreakdown = createSeverityBreakdown;
exports.parseFusedEvent = parseFusedEvent;
exports.safeParseFusedEvent = safeParseFusedEvent;
const zod_1 = require("zod");
// ============ Instrument ============
exports.InstrumentSchema = zod_1.z.object({
    type: zod_1.z.enum(['stock', 'future', 'fund', 'fx', 'crypto', 'etf']),
    symbol: zod_1.z.string(),
    name: zod_1.z.string().optional(),
    exchange: zod_1.z.string().optional(),
});
// ============ Evidence ============
exports.EvidenceSchema = zod_1.z.object({
    source: zod_1.z.enum(['market', 'news', 'social']),
    title: zod_1.z.string(),
    url: zod_1.z.string().optional(),
    ts: zod_1.z.string(),
    platform: zod_1.z.string().optional(),
    postId: zod_1.z.string().optional(),
});
// ============ Action ============
exports.ActionSchema = zod_1.z.object({
    type: zod_1.z.enum(['watch', 'buy', 'sell', 'hold', 'alert']),
    reason: zod_1.z.string(),
});
// ============ Explainable Severity Scores ============
exports.SeverityScoresSchema = zod_1.z.object({
    // Market signal score (0-100)
    market: zod_1.z.number().min(0).max(100).describe('Price change, volume spike, volatility'),
    // News impact score (0-100)
    news: zod_1.z.number().min(0).max(100).describe('Source weight, sentiment, freshness'),
    // Social signal score (0-100)
    social: zod_1.z.number().min(0).max(100).describe('Volume, velocity, sentiment shift'),
});
exports.SeverityBreakdownSchema = zod_1.z.object({
    // Component scores
    scores: exports.SeverityScoresSchema,
    // Cross-validation confidence (0-1)
    confidence: zod_1.z.number().min(0).max(1),
    // Weighted final severity (0-100)
    // Formula: weighted_sum(market*0.4, news*0.35, social*0.25) * confidence
    finalScore: zod_1.z.number().min(0).max(100),
    // AI-generated explanation
    explain: zod_1.z.string().optional(),
});
// ============ News Source ============
exports.NewsSourceSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    url: zod_1.z.string().optional(),
    publisher: zod_1.z.string().optional(),
    publishedAt: zod_1.z.string().optional(),
});
// ============ Social Source ============
exports.SocialSourceSchema = zod_1.z.object({
    platform: zod_1.z.string(),
    author: zod_1.z.string(),
    content: zod_1.z.string(),
    url: zod_1.z.string().optional(),
    engagement: zod_1.z.object({
        likes: zod_1.z.number(),
        comments: zod_1.z.number(),
        shares: zod_1.z.number(),
    }).optional(),
});
// ============ Market Source ============
exports.MarketSourceSchema = zod_1.z.object({
    symbol: zod_1.z.string(),
    change: zod_1.z.number(),
    changePct: zod_1.z.number(),
    volumeRatio: zod_1.z.number().optional(),
});
// ============ FusedEvent v2.0 ============
exports.FusedEventSchemaV2 = zod_1.z.object({
    // Identity
    id: zod_1.z.string().uuid(),
    ts: zod_1.z.string().datetime(),
    // Core content
    title: zod_1.z.string(),
    summary: zod_1.z.string().optional(),
    // Severity (legacy 1-10 for backward compatibility)
    severity: zod_1.z.number().min(1).max(10),
    // NEW: Explainable severity breakdown
    severityBreakdown: exports.SeverityBreakdownSchema.optional(),
    // Classification
    eventType: zod_1.z.enum(['market', 'news', 'social', 'fusion']),
    sentiment: zod_1.z.enum(['bullish', 'bearish', 'neutral', 'mixed', 'unknown']),
    // Targets
    symbols: zod_1.z.array(zod_1.z.string()).default([]),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    instrument: exports.InstrumentSchema.optional(),
    // Sources (NEW: detailed source tracking)
    sources: zod_1.z.object({
        news: zod_1.z.array(exports.NewsSourceSchema).optional(),
        social: zod_1.z.array(exports.SocialSourceSchema).optional(),
        market: zod_1.z.array(exports.MarketSourceSchema).optional(),
    }).optional(),
    // Legacy evidence field (backward compatibility)
    evidence: zod_1.z.array(exports.EvidenceSchema).optional(),
    // Analysis
    impactHypothesis: zod_1.z.array(zod_1.z.string()).optional(),
    confidence: zod_1.z.number().min(0).max(1),
    // Actions
    actions: zod_1.z.array(exports.ActionSchema).optional(),
    // Metadata
    keywords: zod_1.z.array(zod_1.z.string()).optional(),
    location: zod_1.z.string().optional(),
    // Processing metadata
    processedAt: zod_1.z.string().datetime().optional(),
    version: zod_1.z.string().default('2.0'),
});
// Legacy schema alias (backward compatibility)
exports.FusedEventSchema = exports.FusedEventSchemaV2;
// ============ Severity Utilities ============
/**
 * Severity label mapping
 * 1-3: LOW - Noise/general volatility
 * 4-6: MEDIUM - Observable event
 * 7-8: HIGH - High risk/impact (push notification)
 * 9-10: CRITICAL - Force push + generate report
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
/**
 * Calculate final severity from component scores
 */
function calculateSeverity(scores, confidence) {
    // Weighted formula
    const weightedSum = scores.market * 0.40 +
        scores.news * 0.35 +
        scores.social * 0.25;
    // Apply confidence multiplier
    const finalScore = weightedSum * confidence;
    // Convert 0-100 to 1-10 scale
    return Math.max(1, Math.min(10, Math.round(finalScore / 10)));
}
/**
 * Create severity breakdown
 */
function createSeverityBreakdown(scores, confidence, explain) {
    const weightedSum = scores.market * 0.40 +
        scores.news * 0.35 +
        scores.social * 0.25;
    return {
        scores,
        confidence,
        finalScore: weightedSum * confidence,
        explain
    };
}
/**
 * Validate and parse FusedEvent
 */
function parseFusedEvent(data) {
    return exports.FusedEventSchemaV2.parse(data);
}
/**
 * Safe parse FusedEvent (returns null on error)
 */
function safeParseFusedEvent(data) {
    const result = exports.FusedEventSchemaV2.safeParse(data);
    return result.success ? result.data : null;
}
