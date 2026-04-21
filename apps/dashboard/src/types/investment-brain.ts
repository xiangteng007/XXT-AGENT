/* eslint-disable */
/**
 * This file was automatically generated.
 * DO NOT MODIFY IT BY HAND.
 * Instead, modify the source Python Pydantic models in state.py and run 'pnpm run sync:schema'.
 */

export type Symbol = string;
export type Price = number;
export type Open = number;
export type High = number;
export type Low = number;
export type Volume = number;
export type ChangePct1M = number;
export type VolatilityRegime = 'low' | 'normal' | 'high';
export type Timestamp = string;
export type Severity = number;
export type Direction = 'positive' | 'negative';
export type DataQuality = 'live' | 'partial' | 'mock';
export type Regime = 'bull' | 'bear' | 'range' | 'volatile' | 'unknown';
export type Trend = 'up' | 'down' | 'range';
export type Signals = {
  [k: string]: unknown;
}[];
export type Conviction = number;
export type Catalysts = string[];
export type Summary = string;
export type JudgmentBasis = string;
export type UncertaintyWarning = string;
export type IsCredible = boolean;
export type CredibilityScore = number;
export type SentimentDivergence = boolean;
export type DivergenceScore = number;
export type DivergenceDetail = string;
export type VerifiedCatalysts = string[];
export type FakeOrHypeWarnings = string[];
export type Summary1 = string;
export type JudgmentBasis1 = string;
export type CredibilityBasis = string;
export type Action = 'BUY' | 'SELL' | 'HOLD' | 'WATCH' | 'HEDGE' | 'REDUCE' | 'AVOID';
export type Symbol1 = string;
export type AllocationPct = number;
export type EntryPrice = number | null;
export type StopLoss = number | null;
export type TakeProfit = number | null;
export type Timeframe = string;
export type Rationale = string;
export type BasisOfJudgment = string;
export type PlanId = string;
export type Actions = InvestmentAction[];
export type Confidence = number;
export type InvalidationRules = string[];
export type RiskFlags = string[];
export type Rationale1 = string;
export type AdvisoryDisclaimer = string;
export type BacktestEvidence = {
  [k: string]: unknown;
} | null;
export type Approved = boolean;
export type RiskScore = number;
export type Adjustments = {
  [k: string]: unknown;
}[];
export type Warnings = string[];
export type Violations = string[];

export interface StateModels {
  price_snapshot: PriceSnapshot;
  fusion_context: FusionContext;
  market_insight: MarketInsight;
  verification_insight: VerificationInsight;
  investment_action: InvestmentAction;
  investment_plan: InvestmentPlan;
  risk_assessment: RiskAssessment;
  [k: string]: unknown;
}
/**
 * Latest price data from market sources.
 */
export interface PriceSnapshot {
  symbol?: Symbol;
  price?: Price;
  open?: Open;
  high?: High;
  low?: Low;
  volume?: Volume;
  change_pct_1m?: ChangePct1M;
  volatility_regime?: VolatilityRegime;
  timestamp?: Timestamp;
  [k: string]: unknown;
}
/**
 * Triple Fusion context from Event Fusion Engine.
 */
export interface FusionContext {
  market?: Market;
  news?: News;
  social?: Social;
  severity?: Severity;
  direction?: Direction;
  data_quality?: DataQuality;
  credibility_tiers?: CredibilityTiers;
  [k: string]: unknown;
}
export interface Market {
  [k: string]: unknown;
}
export interface News {
  [k: string]: unknown;
}
export interface Social {
  [k: string]: unknown;
}
export interface CredibilityTiers {
  [k: string]: unknown;
}
/**
 * Output of Market Analyst Agent.
 */
export interface MarketInsight {
  regime?: Regime;
  trend?: Trend;
  signals?: Signals;
  conviction?: Conviction;
  key_levels?: KeyLevels;
  catalysts?: Catalysts;
  summary?: Summary;
  judgment_basis?: JudgmentBasis;
  uncertainty_warning?: UncertaintyWarning;
  [k: string]: unknown;
}
export interface KeyLevels {
  [k: string]: unknown;
}
/**
 * Output of Information Verifier (Argus) Agent.
 */
export interface VerificationInsight {
  is_credible?: IsCredible;
  credibility_score?: CredibilityScore;
  sentiment_divergence?: SentimentDivergence;
  divergence_score?: DivergenceScore;
  divergence_detail?: DivergenceDetail;
  verified_catalysts?: VerifiedCatalysts;
  fake_or_hype_warnings?: FakeOrHypeWarnings;
  source_reliability?: SourceReliability;
  summary?: Summary1;
  judgment_basis?: JudgmentBasis1;
  credibility_basis?: CredibilityBasis;
  [k: string]: unknown;
}
export interface SourceReliability {
  [k: string]: unknown;
}
/**
 * Single investment action in a plan.
 */
export interface InvestmentAction {
  action?: Action;
  symbol?: Symbol1;
  allocation_pct?: AllocationPct;
  entry_price?: EntryPrice;
  stop_loss?: StopLoss;
  take_profit?: TakeProfit;
  timeframe?: Timeframe;
  rationale?: Rationale;
  basis_of_judgment?: BasisOfJudgment;
  [k: string]: unknown;
}
/**
 * Output of Strategy Planner Agent.
 */
export interface InvestmentPlan {
  plan_id?: PlanId;
  actions?: Actions;
  scenarios?: Scenarios;
  confidence?: Confidence;
  invalidation_rules?: InvalidationRules;
  risk_flags?: RiskFlags;
  rationale?: Rationale1;
  advisory_disclaimer?: AdvisoryDisclaimer;
  backtest_evidence?: BacktestEvidence;
  [k: string]: unknown;
}
export interface Scenarios {
  [k: string]: unknown;
}
/**
 * Output of Risk Manager Agent.
 */
export interface RiskAssessment {
  approved?: Approved;
  risk_score?: RiskScore;
  adjustments?: Adjustments;
  warnings?: Warnings;
  violations?: Violations;
  adjusted_plan?: InvestmentPlan | null;
  [k: string]: unknown;
}
