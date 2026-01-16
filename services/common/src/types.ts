/**
 * FusedEvent Schema
 * Per SPEC_PHASE6_5_PHASE7_CLOUD.md
 */

import { z } from 'zod';

// Instrument schema
export const InstrumentSchema = z.object({
    type: z.enum(['stock', 'future', 'fund', 'fx', 'crypto']),
    symbol: z.string(),
    name: z.string().optional(),
});

// Evidence schema
export const EvidenceSchema = z.object({
    source: z.enum(['market', 'news', 'social']),
    title: z.string(),
    url: z.string().optional(),
    ts: z.string(),
    platform: z.string().optional(),
    postId: z.string().optional(),
});

// Action schema
export const ActionSchema = z.object({
    type: z.enum(['watch', 'buy', 'sell', 'hold', 'alert']),
    reason: z.string(),
});

// FusedEvent schema (must contain news_title + severity)
export const FusedEventSchema = z.object({
    id: z.string(),
    ts: z.string(),
    instrument: InstrumentSchema.optional(),
    news_title: z.string(), // REQUIRED: Per spec
    severity: z.number().min(1).max(10), // REQUIRED: Per spec (1-10)
    event_type: z.enum(['market', 'news', 'social', 'fusion']),
    sentiment: z.enum(['bullish', 'bearish', 'neutral', 'unknown']),
    impact_hypothesis: z.array(z.string()),
    evidence: z.array(EvidenceSchema),
    confidence: z.number().min(0).max(1),
    actions: z.array(ActionSchema),
    keywords: z.array(z.string()).optional(),
    location: z.string().optional(),
});

// Export types
export type Instrument = z.infer<typeof InstrumentSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type FusedEvent = z.infer<typeof FusedEventSchema>;

// Raw event types (before fusion)
export interface RawMarketEvent {
    id: string;
    ts: string;
    source: 'market';
    symbol: string;
    quote: {
        last_price: number | null;
        change_pct?: number;
        volume?: number;
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
}

export type RawEvent = RawMarketEvent | RawNewsEvent | RawSocialEvent;

/**
 * Severity mapping (1-10)
 * 1-3: Noise/general volatility
 * 4-6: Observable event (may affect short-term)
 * 7-8: High risk/impact (should push)
 * 9-10: Critical event (force push + generate report)
 */
export function getSeverityLabel(severity: number): string {
    if (severity >= 9) return '🔴 CRITICAL';
    if (severity >= 7) return '🟠 HIGH';
    if (severity >= 4) return '🟡 MEDIUM';
    return '⚪ LOW';
}
