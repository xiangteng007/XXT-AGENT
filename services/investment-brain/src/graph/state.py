"""
Investment Brain — Agent State Schema

Defines the shared state that flows through the LangGraph supervisor graph.
All agents read from and write to this state.
"""
from __future__ import annotations

from typing import Annotated, Literal, TypedDict
from datetime import datetime

from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


# ── Sub-schemas ────────────────────────────────────────────


class PriceSnapshot(TypedDict, total=False):
    """Latest price data from market sources."""
    symbol: str
    price: float
    open: float
    high: float
    low: float
    volume: float
    change_pct_1m: float
    volatility_regime: Literal["low", "normal", "high"]
    timestamp: str


class FusionContext(TypedDict, total=False):
    """Triple Fusion context from Event Fusion Engine."""
    market: dict
    news: dict
    social: dict
    severity: int
    direction: Literal["positive", "negative"]
    # F-02: data quality metadata
    data_quality: Literal["live", "partial", "mock"]
    credibility_tiers: dict   # source-level quality ratings


class MarketInsight(TypedDict, total=False):
    """Output of Market Analyst Agent."""
    regime: Literal["bull", "bear", "range", "volatile", "unknown"]
    trend: Literal["up", "down", "range"]
    signals: list[dict]
    conviction: int  # 0-100
    key_levels: dict  # support/resistance
    catalysts: list[str]
    summary: str
    judgment_basis: str  # P3-01: Explicit reasoning basis
    uncertainty_warning: str  # P3-01: Used for fallback/degraded data

class VerificationInsight(TypedDict, total=False):
    """Output of Information Verifier (Argus) Agent."""
    is_credible:           bool
    credibility_score:     int        # A-02: 0–100, calc per verifier prompt rules
    sentiment_divergence:  bool
    divergence_score:      float      # P3-03: calculated divergence score (0-1)
    divergence_detail:     str        # A-02: plain-language explanation
    verified_catalysts:    list[str]
    fake_or_hype_warnings: list[str]
    source_reliability:    dict       # {news_quality, social_quality, cross_reference_count}
    summary:               str
    judgment_basis:        str        # A-02: required for advisory compliance
    credibility_basis:     str        # P3-03: specific conflicting evidence


class InvestmentAction(TypedDict, total=False):
    """Single investment action in a plan."""
    action: Literal["BUY", "SELL", "HOLD", "WATCH", "HEDGE", "REDUCE", "AVOID"]
    symbol: str
    allocation_pct: float
    entry_price: float | None
    stop_loss: float | None
    take_profit: float | None
    timeframe: str
    rationale: str
    basis_of_judgment: str  # P3-02: Advisory framing required


class InvestmentPlan(TypedDict, total=False):
    """Output of Strategy Planner Agent."""
    plan_id:              str
    actions:              list[InvestmentAction]
    scenarios:            dict   # base/bull/bear probabilities
    confidence:           int    # 0-100
    invalidation_rules:   list[str]
    risk_flags:           list[str]
    rationale:            str
    advisory_disclaimer:  str    # A-03: mandatory advisory framing field
    backtest_evidence:    dict | None  # F-03: structured backtest metrics from BacktestEngine


class RiskAssessment(TypedDict, total=False):
    """Output of Risk Manager Agent."""
    approved: bool
    risk_score: int  # 0-100 (higher = riskier)
    adjustments: list[dict]
    warnings: list[str]
    violations: list[str]  # hard limit violations
    adjusted_plan: InvestmentPlan | None


class TradeResult(TypedDict, total=False):
    """Output of Execution Simulator Agent."""
    trade_id: str
    symbol: str
    action: str
    entry_price: float
    exit_price: float | None
    pnl: float
    pnl_pct: float
    status: Literal["open", "closed", "stopped_out", "take_profit"]
    opened_at: str
    closed_at: str | None


class PortfolioState(TypedDict, total=False):
    """Current virtual portfolio state."""
    total_value: float
    cash: float
    positions: list[dict]
    daily_pnl: float
    daily_pnl_pct: float
    max_drawdown: float
    sharpe_ratio: float | None
    win_rate: float | None
    total_trades: int


class StrategyMemory(TypedDict, total=False):
    """Past strategy performance for learning."""
    successful_patterns: list[str]
    failed_patterns: list[str]
    regime_preferences: dict  # regime -> preferred strategy
    last_updated: str


# ── Main Agent State ───────────────────────────────────────


class InvestmentAgentState(TypedDict, total=False):
    """
    The shared state flowing through the LangGraph investment supervisor.

    Each node reads what it needs and writes its output section.
    The supervisor routes between nodes based on the current step.
    """
    # ── Routing & Control ────────────────────────────────
    messages: Annotated[list[BaseMessage], add_messages]
    current_step: Literal[
        "analyze",       # Market Analyst
        "plan",          # Strategy Planner
        "risk_check",    # Risk Manager
        "execute",       # Execution Simulator
        "evaluate",      # Evaluator (feedback loop)
        "complete",      # Done
        "error",         # Error state
    ]
    error: str | None

    # ── User Input ───────────────────────────────────────
    symbol: str
    timeframe: str
    risk_level: Literal["conservative", "moderate", "aggressive"]
    execution_mode: Literal["advisory", "paper_trade", "live"]  # P5-01: Execution mode strategy
    user_context: str | None  # Additional user instructions

    # ── Market Data (from Event Fusion Engine) ───────────
    price_snapshot: PriceSnapshot | None
    fusion_context: FusionContext | None

    # ── Agent Outputs ────────────────────────────────────
    market_insight: MarketInsight | None
    verification_insight: VerificationInsight | None
    investment_plan: InvestmentPlan | None
    risk_assessment: RiskAssessment | None
    trade_results: list[TradeResult]
    portfolio: PortfolioState | None

    # ── Learning & Memory ────────────────────────────────
    strategy_memory: StrategyMemory | None
    trajectory_id: str | None  # For feedback loop tracking

    # ── Metadata ─────────────────────────────────────────
    session_id: str
    started_at: str
    completed_at: str | None
    iteration: int  # For feedback loop counting
    max_iterations: int  # P1-03: Hard cap on risk→plan retry loops (default 2)


def create_initial_state(
    symbol: str,
    timeframe: str = "1h",
    risk_level: str = "moderate",
    execution_mode: str = "advisory",
    user_context: str | None = None,
    session_id: str | None = None,
) -> InvestmentAgentState:
    """Create a fresh initial state for a new investment analysis session."""
    import uuid

    return InvestmentAgentState(
        messages=[],
        current_step="analyze",
        error=None,
        symbol=symbol.upper().strip(),
        timeframe=timeframe,
        risk_level=risk_level,  # type: ignore[arg-type]
        execution_mode=execution_mode, # type: ignore[arg-type]
        user_context=user_context,
        price_snapshot=None,
        fusion_context=None,
        market_insight=None,
        verification_insight=None,
        investment_plan=None,
        risk_assessment=None,
        trade_results=[],
        portfolio=None,
        strategy_memory=None,
        trajectory_id=None,
        session_id=session_id or str(uuid.uuid4()),
        started_at=datetime.utcnow().isoformat(),
        completed_at=None,
        iteration=0,
        max_iterations=2,
    )
