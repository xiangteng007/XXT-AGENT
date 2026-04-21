/**
 * P2-01: Shared Investment Brain ↔ Gateway Schema Contract
 *
 * This file defines the TypeScript interfaces that mirror the Python
 * InvestmentAgentState, ensuring compile-time type safety for the
 * Gateway → Brain → Gateway data flow.
 *
 * The Python counterpart is in:
 *   services/investment-brain/src/graph/state.py
 *
 * ⚠️ SYNC RULE: The core types are now auto-generated in investmentState.ts.
 *    Any change to state.py's TypedDict fields MUST be reflected there.
 *    Run `npm run typecheck` to verify.
 */

import {
  PriceSnapshot,
  MarketInsight,
  VerificationInsight,
  InvestmentPlan,
  RiskAssessment
} from './investmentState';

export * from './investmentState';

// ── Request Types (Gateway → Brain) ──────────────────────────

export interface InvestBrainAnalyzeRequest {
  symbol: string;
  timeframe?: string;    // default: '1h'
  risk_level?: string;   // 'conservative' | 'moderate' | 'aggressive'
  execution_mode?: 'advisory' | 'paper_trade' | 'live';
  user_context?: string; // Free-form user notes
}

// ── Full Response (Brain → Gateway) ──────────────────────────

export interface InvestBrainAnalyzeResponse {
  session_id: string;
  status: 'completed' | 'failed' | 'timeout';
  symbol: string;
  timeframe: string;
  risk_level: string;
  price_snapshot: PriceSnapshot | null;
  market_insight: MarketInsight | null;
  verification_insight: VerificationInsight | null;
  investment_plan: InvestmentPlan | null;
  risk_assessment: RiskAssessment | null;
  iteration: number;
  max_iterations: number;  // P1-03
  started_at: string;
  completed_at: string | null;
}
