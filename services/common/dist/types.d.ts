/**
 * FusedEvent Schema
 * Per SPEC_PHASE6_5_PHASE7_CLOUD.md
 */
import { z } from 'zod';
export declare const InstrumentSchema: z.ZodObject<{
    type: z.ZodEnum<["stock", "future", "fund", "fx", "crypto"]>;
    symbol: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    type: "crypto" | "stock" | "future" | "fund" | "fx";
    name?: string | undefined;
}, {
    symbol: string;
    type: "crypto" | "stock" | "future" | "fund" | "fx";
    name?: string | undefined;
}>;
export declare const EvidenceSchema: z.ZodObject<{
    source: z.ZodEnum<["market", "news", "social"]>;
    title: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    ts: z.ZodString;
    platform: z.ZodOptional<z.ZodString>;
    postId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: "market" | "social" | "news";
    title: string;
    ts: string;
    platform?: string | undefined;
    url?: string | undefined;
    postId?: string | undefined;
}, {
    source: "market" | "social" | "news";
    title: string;
    ts: string;
    platform?: string | undefined;
    url?: string | undefined;
    postId?: string | undefined;
}>;
export declare const ActionSchema: z.ZodObject<{
    type: z.ZodEnum<["watch", "buy", "sell", "hold", "alert"]>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "alert" | "watch" | "buy" | "sell" | "hold";
    reason: string;
}, {
    type: "alert" | "watch" | "buy" | "sell" | "hold";
    reason: string;
}>;
export declare const FusedEventSchema: z.ZodObject<{
    id: z.ZodString;
    ts: z.ZodString;
    instrument: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["stock", "future", "fund", "fx", "crypto"]>;
        symbol: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx";
        name?: string | undefined;
    }, {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx";
        name?: string | undefined;
    }>>;
    news_title: z.ZodString;
    severity: z.ZodNumber;
    event_type: z.ZodEnum<["market", "news", "social", "fusion"]>;
    sentiment: z.ZodEnum<["bullish", "bearish", "neutral", "unknown"]>;
    impact_hypothesis: z.ZodArray<z.ZodString, "many">;
    evidence: z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<["market", "news", "social"]>;
        title: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
        ts: z.ZodString;
        platform: z.ZodOptional<z.ZodString>;
        postId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }, {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }>, "many">;
    confidence: z.ZodNumber;
    actions: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["watch", "buy", "sell", "hold", "alert"]>;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }, {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }>, "many">;
    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    location: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    ts: string;
    news_title: string;
    severity: number;
    sentiment: "unknown" | "bullish" | "bearish" | "neutral";
    impact_hypothesis: string[];
    evidence: {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }[];
    confidence: number;
    event_type: "market" | "social" | "news" | "fusion";
    actions: {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }[];
    location?: string | undefined;
    instrument?: {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx";
        name?: string | undefined;
    } | undefined;
    keywords?: string[] | undefined;
}, {
    id: string;
    ts: string;
    news_title: string;
    severity: number;
    sentiment: "unknown" | "bullish" | "bearish" | "neutral";
    impact_hypothesis: string[];
    evidence: {
        source: "market" | "social" | "news";
        title: string;
        ts: string;
        platform?: string | undefined;
        url?: string | undefined;
        postId?: string | undefined;
    }[];
    confidence: number;
    event_type: "market" | "social" | "news" | "fusion";
    actions: {
        type: "alert" | "watch" | "buy" | "sell" | "hold";
        reason: string;
    }[];
    location?: string | undefined;
    instrument?: {
        symbol: string;
        type: "crypto" | "stock" | "future" | "fund" | "fx";
        name?: string | undefined;
    } | undefined;
    keywords?: string[] | undefined;
}>;
export type Instrument = z.infer<typeof InstrumentSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type FusedEvent = z.infer<typeof FusedEventSchema>;
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
export declare function getSeverityLabel(severity: number): string;
