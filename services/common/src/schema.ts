import { z } from "zod";

export const RawMarketEvent = z.object({
  id: z.string(),
  ts: z.string(),
  source: z.literal("market"),
  symbol: z.string(),
  quote: z.object({
    price: z.number().nullable(),
    changePct5m: z.number().nullable().optional()
  }).passthrough()
}).passthrough();

export const FusedEvent = z.object({
  id: z.string(),
  ts: z.string(),
  tenantId: z.string().default("default"),
  domain: z.enum(["social", "market", "news", "fusion", "alert"]),
  eventType: z.string(),
  news_title: z.string(),
  severity: z.number().min(1).max(100),
  instrument: z.object({
    type: z.string(),
    symbol: z.string(),
    name: z.string().optional()
  }),
  sentiment: z.enum(["bullish", "bearish", "neutral", "unknown"]).default("unknown"),
  impact_hypothesis: z.array(z.string()).default([]),
  evidence: z.array(z.any()).default([]),
  confidence: z.number().min(0).max(1).default(0.5)
}).passthrough();
