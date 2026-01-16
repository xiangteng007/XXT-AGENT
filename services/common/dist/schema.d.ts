import { z } from "zod";
export declare const RawMarketEvent: z.ZodObject<{
    id: z.ZodString;
    ts: z.ZodString;
    source: z.ZodLiteral<"market">;
    symbol: z.ZodString;
    quote: z.ZodObject<{
        price: z.ZodNullable<z.ZodNumber>;
        changePct5m: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        price: z.ZodNullable<z.ZodNumber>;
        changePct5m: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        price: z.ZodNullable<z.ZodNumber>;
        changePct5m: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.ZodTypeAny, "passthrough">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    ts: z.ZodString;
    source: z.ZodLiteral<"market">;
    symbol: z.ZodString;
    quote: z.ZodObject<{
        price: z.ZodNullable<z.ZodNumber>;
        changePct5m: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        price: z.ZodNullable<z.ZodNumber>;
        changePct5m: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        price: z.ZodNullable<z.ZodNumber>;
        changePct5m: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.ZodTypeAny, "passthrough">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    ts: z.ZodString;
    source: z.ZodLiteral<"market">;
    symbol: z.ZodString;
    quote: z.ZodObject<{
        price: z.ZodNullable<z.ZodNumber>;
        changePct5m: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        price: z.ZodNullable<z.ZodNumber>;
        changePct5m: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        price: z.ZodNullable<z.ZodNumber>;
        changePct5m: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.ZodTypeAny, "passthrough">>;
}, z.ZodTypeAny, "passthrough">>;
export declare const FusedEvent: z.ZodObject<{
    id: z.ZodString;
    ts: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    domain: z.ZodEnum<["social", "market", "news", "fusion", "alert"]>;
    eventType: z.ZodString;
    news_title: z.ZodString;
    severity: z.ZodNumber;
    instrument: z.ZodObject<{
        type: z.ZodString;
        symbol: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        type: string;
        name?: string | undefined;
    }, {
        symbol: string;
        type: string;
        name?: string | undefined;
    }>;
    sentiment: z.ZodDefault<z.ZodEnum<["bullish", "bearish", "neutral", "unknown"]>>;
    impact_hypothesis: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    evidence: z.ZodDefault<z.ZodArray<z.ZodAny, "many">>;
    confidence: z.ZodDefault<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    ts: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    domain: z.ZodEnum<["social", "market", "news", "fusion", "alert"]>;
    eventType: z.ZodString;
    news_title: z.ZodString;
    severity: z.ZodNumber;
    instrument: z.ZodObject<{
        type: z.ZodString;
        symbol: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        type: string;
        name?: string | undefined;
    }, {
        symbol: string;
        type: string;
        name?: string | undefined;
    }>;
    sentiment: z.ZodDefault<z.ZodEnum<["bullish", "bearish", "neutral", "unknown"]>>;
    impact_hypothesis: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    evidence: z.ZodDefault<z.ZodArray<z.ZodAny, "many">>;
    confidence: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    ts: z.ZodString;
    tenantId: z.ZodDefault<z.ZodString>;
    domain: z.ZodEnum<["social", "market", "news", "fusion", "alert"]>;
    eventType: z.ZodString;
    news_title: z.ZodString;
    severity: z.ZodNumber;
    instrument: z.ZodObject<{
        type: z.ZodString;
        symbol: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        type: string;
        name?: string | undefined;
    }, {
        symbol: string;
        type: string;
        name?: string | undefined;
    }>;
    sentiment: z.ZodDefault<z.ZodEnum<["bullish", "bearish", "neutral", "unknown"]>>;
    impact_hypothesis: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    evidence: z.ZodDefault<z.ZodArray<z.ZodAny, "many">>;
    confidence: z.ZodDefault<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
