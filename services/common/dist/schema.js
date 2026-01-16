"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FusedEvent = exports.RawMarketEvent = void 0;
const zod_1 = require("zod");
exports.RawMarketEvent = zod_1.z.object({
    id: zod_1.z.string(),
    ts: zod_1.z.string(),
    source: zod_1.z.literal("market"),
    symbol: zod_1.z.string(),
    quote: zod_1.z.object({
        price: zod_1.z.number().nullable(),
        changePct5m: zod_1.z.number().nullable().optional()
    }).passthrough()
}).passthrough();
exports.FusedEvent = zod_1.z.object({
    id: zod_1.z.string(),
    ts: zod_1.z.string(),
    tenantId: zod_1.z.string().default("default"),
    domain: zod_1.z.enum(["social", "market", "news", "fusion", "alert"]),
    eventType: zod_1.z.string(),
    news_title: zod_1.z.string(),
    severity: zod_1.z.number().min(1).max(100),
    instrument: zod_1.z.object({
        type: zod_1.z.string(),
        symbol: zod_1.z.string(),
        name: zod_1.z.string().optional()
    }),
    sentiment: zod_1.z.enum(["bullish", "bearish", "neutral", "unknown"]).default("unknown"),
    impact_hypothesis: zod_1.z.array(zod_1.z.string()).default([]),
    evidence: zod_1.z.array(zod_1.z.any()).default([]),
    confidence: zod_1.z.number().min(0).max(1).default(0.5)
}).passthrough();
