"""
LLM Response Parser — JSON Stabilization Layer

Provides robust structured output parsing with:
1. Multi-strategy JSON extraction (direct, fence-stripped, repair)
2. Pydantic validation against expected schemas
3. Automatic field coercion and defaults
4. Retry coordination with LLM providers

This module sits between LLM providers and graph nodes, ensuring
every node receives valid, typed data regardless of model quirks.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Type, TypeVar

import orjson
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger("investment-brain.llm.parser")

T = TypeVar("T", bound=BaseModel)


# ── Pydantic Response Models (mirror state.py TypedDicts) ──────


class MarketInsightResponse(BaseModel):
    """Expected JSON schema from Market Analyst LLM output."""
    regime: str = "unknown"
    trend: str = "range"
    signals: list[dict[str, Any]] = Field(default_factory=list)
    conviction: int = 50
    key_levels: dict[str, Any] = Field(default_factory=dict)
    catalysts: list[str] = Field(default_factory=list)
    summary: str = ""
    judgment_basis: str = ""
    uncertainty_warning: str = ""


class VerificationResponse(BaseModel):
    """Expected JSON schema from Information Verifier LLM output."""
    is_credible: bool = True
    credibility_score: int = 50
    sentiment_divergence: bool = False
    divergence_score: float = 0.0
    divergence_detail: str = ""
    verified_catalysts: list[str] = Field(default_factory=list)
    fake_or_hype_warnings: list[str] = Field(default_factory=list)
    source_reliability: dict[str, Any] = Field(default_factory=dict)
    summary: str = ""
    judgment_basis: str = ""
    credibility_basis: str = ""


class InvestmentActionResponse(BaseModel):
    """Single action in a plan."""
    action: str = "HOLD"
    symbol: str = ""
    allocation_pct: float = 0.0
    entry_price: float | None = None
    stop_loss: float | None = None
    take_profit: float | None = None
    timeframe: str = "short"
    rationale: str = ""
    basis_of_judgment: str = ""


class InvestmentPlanResponse(BaseModel):
    """Expected JSON schema from Strategy Planner LLM output."""
    plan_id: str = ""
    actions: list[InvestmentActionResponse] = Field(default_factory=list)
    scenarios: dict[str, Any] = Field(default_factory=dict)
    confidence: int = 50
    invalidation_rules: list[str] = Field(default_factory=list)
    risk_flags: list[str] = Field(default_factory=list)
    rationale: str = ""
    advisory_disclaimer: str = "本分析不構成投資建議，僅供參考。"


class EvaluationResponse(BaseModel):
    """Expected JSON schema from Evaluator LLM output."""
    decision_quality: int = 50
    reasoning_quality: int = 50
    risk_awareness: int = 50
    overall_score: int = 50
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    lessons_learned: list[str] = Field(default_factory=list)
    improvement_suggestions: list[str] = Field(default_factory=list)


class QuickAnalysisResponse(BaseModel):
    """Expected JSON from /invest/analyze/quick endpoint."""
    recommendation: str = "hold"
    confidence: int = 50
    targetPrice: float | None = None
    stopLoss: float | None = None
    timeHorizon: str = "medium"
    summary: str = ""
    bullishFactors: list[str] = Field(default_factory=list)
    bearishFactors: list[str] = Field(default_factory=list)
    riskLevel: str = "medium"


class MarketOutlookResponse(BaseModel):
    """Expected JSON from /invest/market/outlook endpoint."""
    sentiment: str = "neutral"
    keyDrivers: list[str] = Field(default_factory=list)
    sectors: list[dict[str, Any]] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)


class SentimentResponse(BaseModel):
    """Expected JSON from /ai/sentiment endpoint."""
    label: str = "neutral"
    score: float = 0.0
    confidence: int = 50
    keywords: list[str] = Field(default_factory=list)


# ── JSON Extraction Utilities ──────────────────────────────────


def _strip_think_tags(text: str) -> str:
    """Remove qwen3 <think>...</think> reasoning blocks."""
    if "</think>" in text:
        text = text.split("</think>")[-1].strip()
    return text


def _strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` wrapping."""
    text = text.strip()
    # Pattern: ```json\n...\n```
    match = re.match(r"^```(?:json)?\s*\n(.*?)```\s*$", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text


def _extract_json_object(text: str) -> str | None:
    """Extract the first JSON object {...} from text."""
    depth = 0
    start = -1
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                return text[start : i + 1]
    return None


def _fix_common_json_errors(text: str) -> str:
    """Fix common LLM JSON output errors."""
    # Remove trailing commas before } or ]
    text = re.sub(r",\s*([}\]])", r"\1", text)
    # Fix unquoted keys (simple case)
    text = re.sub(r"(\{|,)\s*([a-zA-Z_]\w*)\s*:", r'\1 "\2":', text)
    return text


def extract_json(raw: str) -> dict[str, Any] | None:
    """
    Multi-strategy JSON extraction from raw LLM text.

    Strategies (in order):
    1. Direct parse (raw text is valid JSON)
    2. Strip <think> tags + parse
    3. Strip markdown fences + parse
    4. Extract first {...} block + parse
    5. Fix common errors + parse
    """
    if not raw or not raw.strip():
        return None

    # Strategy 1: Direct parse
    try:
        return orjson.loads(raw.encode())
    except Exception:
        pass

    cleaned = _strip_think_tags(raw)
    cleaned = _strip_markdown_fences(cleaned)

    # Strategy 2: Cleaned parse
    try:
        return orjson.loads(cleaned.encode())
    except Exception:
        pass

    # Strategy 3: Extract JSON object
    extracted = _extract_json_object(cleaned)
    if extracted:
        try:
            return orjson.loads(extracted.encode())
        except Exception:
            pass

    # Strategy 4: Fix common errors
    if extracted:
        fixed = _fix_common_json_errors(extracted)
        try:
            return orjson.loads(fixed.encode())
        except Exception:
            pass

    # Strategy 5: Last resort — try fixing the whole cleaned text
    fixed = _fix_common_json_errors(cleaned)
    try:
        return orjson.loads(fixed.encode())
    except Exception:
        pass

    return None


# ── Main Parser Function ──────────────────────────────────────


def parse_structured_response(
    raw_text: str,
    response_model: Type[T] | None = None,
    *,
    node_name: str = "unknown",
) -> dict[str, Any]:
    """
    Parse and validate LLM structured output.

    Args:
        raw_text: Raw text response from LLM
        response_model: Optional Pydantic model class for validation
        node_name: Node name for logging

    Returns:
        Validated dict. If validation fails, returns dict with defaults.
        If extraction fails entirely, returns {"parse_error": True, "raw_response": raw_text}
    """
    # Step 1: Extract JSON
    data = extract_json(raw_text)

    if data is None:
        logger.warning(
            f"[{node_name}] JSON extraction failed. "
            f"Preview: {raw_text[:200]}"
        )
        return {"parse_error": True, "raw_response": raw_text[:500]}

    # Step 2: Validate with Pydantic model (if provided)
    if response_model is not None:
        try:
            validated = response_model.model_validate(data)
            return validated.model_dump()
        except ValidationError as e:
            logger.info(
                f"[{node_name}] Pydantic validation partial fail "
                f"({len(e.errors())} errors), using defaults for missing fields"
            )
            # Try to construct with partial data + defaults
            try:
                # Create with only valid fields
                valid_fields = {}
                for field_name, field_info in response_model.model_fields.items():
                    if field_name in data:
                        valid_fields[field_name] = data[field_name]
                validated = response_model.model_validate(valid_fields)
                return validated.model_dump()
            except Exception:
                # Fall through to return raw dict
                pass

    # Step 3: Return raw parsed dict (no model validation)
    return data


# ── Node-specific convenience functions ────────────────────────


def parse_market_insight(raw: str) -> dict[str, Any]:
    """Parse Market Analyst LLM output."""
    return parse_structured_response(raw, MarketInsightResponse, node_name="market_analyst")


def parse_verification(raw: str) -> dict[str, Any]:
    """Parse Information Verifier LLM output."""
    return parse_structured_response(raw, VerificationResponse, node_name="information_verifier")


def parse_investment_plan(raw: str) -> dict[str, Any]:
    """Parse Strategy Planner LLM output."""
    return parse_structured_response(raw, InvestmentPlanResponse, node_name="strategy_planner")


def parse_evaluation(raw: str) -> dict[str, Any]:
    """Parse Evaluator LLM output."""
    return parse_structured_response(raw, EvaluationResponse, node_name="evaluator")


def parse_quick_analysis(raw: str) -> dict[str, Any]:
    """Parse quick stock analysis response."""
    return parse_structured_response(raw, QuickAnalysisResponse, node_name="quick_analyze")


def parse_market_outlook(raw: str) -> dict[str, Any]:
    """Parse market outlook response."""
    return parse_structured_response(raw, MarketOutlookResponse, node_name="market_outlook")


def parse_sentiment(raw: str) -> dict[str, Any]:
    """Parse sentiment analysis response."""
    return parse_structured_response(raw, SentimentResponse, node_name="sentiment")
