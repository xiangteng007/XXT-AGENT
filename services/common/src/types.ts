/**
 * FusedEvent Schema v2.0
 * Enhanced with explainable severity scores
 * 
 * Per XXT-AGENT Production-Grade Upgrade Plan
 */

import { z } from 'zod';

// ============ Instrument ============
export const InstrumentSchema = z.object({
    type: z.enum(['stock', 'future', 'fund', 'fx', 'crypto', 'etf']),
    symbol: z.string(),
    name: z.string().optional(),
    exchange: z.string().optional(),
});

// ============ Evidence ============
export const EvidenceSchema = z.object({
    source: z.enum(['market', 'news', 'social']),
    title: z.string(),
    url: z.string().optional(),
    ts: z.string(),
    platform: z.string().optional(),
    postId: z.string().optional(),
});

// ============ Action ============
export const ActionSchema = z.object({
    type: z.enum(['watch', 'buy', 'sell', 'hold', 'alert']),
    reason: z.string(),
});

// ============ Explainable Severity Scores ============
export const SeverityScoresSchema = z.object({
    // Market signal score (0-100)
    market: z.number().min(0).max(100).describe('Price change, volume spike, volatility'),

    // News impact score (0-100)
    news: z.number().min(0).max(100).describe('Source weight, sentiment, freshness'),

    // Social signal score (0-100)
    social: z.number().min(0).max(100).describe('Volume, velocity, sentiment shift'),
});

export const SeverityBreakdownSchema = z.object({
    // Component scores
    scores: SeverityScoresSchema,

    // Cross-validation confidence (0-1)
    confidence: z.number().min(0).max(1),

    // Weighted final severity (0-100)
    // Formula: weighted_sum(market*0.4, news*0.35, social*0.25) * confidence
    finalScore: z.number().min(0).max(100),

    // AI-generated explanation
    explain: z.string().optional(),
});

// ============ News Source ============
export const NewsSourceSchema = z.object({
    id: z.string(),
    title: z.string(),
    url: z.string().optional(),
    publisher: z.string().optional(),
    publishedAt: z.string().optional(),
});

// ============ Social Source ============
export const SocialSourceSchema = z.object({
    platform: z.string(),
    author: z.string(),
    content: z.string(),
    url: z.string().optional(),
    engagement: z.object({
        likes: z.number(),
        comments: z.number(),
        shares: z.number(),
    }).optional(),
});

// ============ Market Source ============
export const MarketSourceSchema = z.object({
    symbol: z.string(),
    change: z.number(),
    changePct: z.number(),
    volumeRatio: z.number().optional(),
});

// ============ FusedEvent v2.0 ============
export const FusedEventSchemaV2 = z.object({
    // Identity
    id: z.string().uuid(),
    ts: z.string().datetime(),

    // Core content
    title: z.string(),
    summary: z.string().optional(),

    // Severity (legacy 1-10 for backward compatibility)
    severity: z.number().min(1).max(10),

    // NEW: Explainable severity breakdown
    severityBreakdown: SeverityBreakdownSchema.optional(),

    // Classification
    eventType: z.enum(['market', 'news', 'social', 'fusion']),
    sentiment: z.enum(['bullish', 'bearish', 'neutral', 'mixed', 'unknown']),

    // Targets
    symbols: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    instrument: InstrumentSchema.optional(),

    // Sources (NEW: detailed source tracking)
    sources: z.object({
        news: z.array(NewsSourceSchema).optional(),
        social: z.array(SocialSourceSchema).optional(),
        market: z.array(MarketSourceSchema).optional(),
    }).optional(),

    // Legacy evidence field (backward compatibility)
    evidence: z.array(EvidenceSchema).optional(),

    // Analysis
    impactHypothesis: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1),

    // Actions
    actions: z.array(ActionSchema).optional(),

    // Metadata
    keywords: z.array(z.string()).optional(),
    location: z.string().optional(),

    // Processing metadata
    processedAt: z.string().datetime().optional(),
    version: z.string().default('2.0'),
});

// Legacy schema alias (backward compatibility)
export const FusedEventSchema = FusedEventSchemaV2;

// ============ Export Types ============
export type Instrument = z.infer<typeof InstrumentSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type SeverityScores = z.infer<typeof SeverityScoresSchema>;
export type SeverityBreakdown = z.infer<typeof SeverityBreakdownSchema>;
export type NewsSource = z.infer<typeof NewsSourceSchema>;
export type SocialSource = z.infer<typeof SocialSourceSchema>;
export type MarketSource = z.infer<typeof MarketSourceSchema>;
export type FusedEvent = z.infer<typeof FusedEventSchemaV2>;

// ============ Raw Event Types ============
export interface RawMarketEvent {
    id: string;
    ts: string;
    source: 'market';
    symbol: string;
    quote: {
        last_price: number | null;
        change_pct?: number;
        volume?: number;
        volumeRatio?: number;
    };
}

export interface RawNewsEvent {
    id: string;
    ts: string;
    source: 'news';
    title: string;
    url: string;
    publisher?: string;
    summary?: string;
    keywords?: string[];
    sentiment?: string;
}

export interface RawSocialEvent {
    id: string;
    ts: string;
    source: 'social';
    platform: string;
    postId: string;
    author: string;
    text: string;
    url?: string;
    engagement?: {
        likes: number;
        comments: number;
        shares: number;
    };
    sentiment?: string;
}

export type RawEvent = RawMarketEvent | RawNewsEvent | RawSocialEvent;

// ============ Severity Utilities ============

/**
 * Severity label mapping
 * 1-3: LOW - Noise/general volatility
 * 4-6: MEDIUM - Observable event
 * 7-8: HIGH - High risk/impact (push notification)
 * 9-10: CRITICAL - Force push + generate report
 */
export function getSeverityLabel(severity: number): string {
    if (severity >= 9) return '🔴 CRITICAL';
    if (severity >= 7) return '🟠 HIGH';
    if (severity >= 4) return '🟡 MEDIUM';
    return '⚪ LOW';
}

/**
 * Calculate final severity from component scores
 */
export function calculateSeverity(scores: SeverityScores, confidence: number): number {
    // Weighted formula
    const weightedSum =
        scores.market * 0.40 +
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
export function createSeverityBreakdown(
    scores: SeverityScores,
    confidence: number,
    explain?: string
): SeverityBreakdown {
    const weightedSum =
        scores.market * 0.40 +
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
export function parseFusedEvent(data: unknown): FusedEvent {
    return FusedEventSchemaV2.parse(data);
}

/**
 * Safe parse FusedEvent (returns null on error)
 */
export function safeParseFusedEvent(data: unknown): FusedEvent | null {
    const result = FusedEventSchemaV2.safeParse(data);
    return result.success ? result.data : null;
}
