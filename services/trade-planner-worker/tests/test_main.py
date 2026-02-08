"""
Trade Planner Worker — Unit Tests

Tests for support/resistance, trend detection, volatility regime, and fallback response.
"""
import pytest


# ─── Support / Resistance ─────────────────────

class TestComputeSupportResistance:
    def test_basic_candles(self):
        from src.main import compute_support_resistance
        candles = [
            {"low": 100.0, "high": 110.0},
            {"low": 102.0, "high": 115.0},
            {"low": 98.0, "high": 112.0},
        ]
        support, resistance = compute_support_resistance(candles)
        assert support == [98.0]
        assert resistance == [115.0]

    def test_empty_candles(self):
        from src.main import compute_support_resistance
        support, resistance = compute_support_resistance([])
        assert support == []
        assert resistance == []

    def test_single_candle(self):
        from src.main import compute_support_resistance
        candles = [{"low": 50.0, "high": 55.0}]
        support, resistance = compute_support_resistance(candles)
        assert support == [50.0]
        assert resistance == [55.0]


# ─── Trend Label ──────────────────────────────

class TestTrendLabel:
    def test_uptrend(self):
        from src.main import trend_label
        candles = [{"close": 100.0}] + [{"close": 100.0}] * 18 + [{"close": 105.0}]
        assert trend_label(candles) == "up"

    def test_downtrend(self):
        from src.main import trend_label
        candles = [{"close": 100.0}] + [{"close": 100.0}] * 18 + [{"close": 95.0}]
        assert trend_label(candles) == "down"

    def test_range(self):
        from src.main import trend_label
        candles = [{"close": 100.0}] * 20
        assert trend_label(candles) == "range"

    def test_insufficient_data(self):
        from src.main import trend_label
        candles = [{"close": 100.0}] * 5
        assert trend_label(candles) == "range"

    def test_exactly_20_candles(self):
        from src.main import trend_label
        candles = [{"close": 100.0}] * 19 + [{"close": 102.0}]
        # 2% up > 1% threshold
        assert trend_label(candles) == "up"


# ─── Volatility Regime ────────────────────────

class TestVolatilityRegime:
    def test_high_volatility(self):
        from src.main import volatility_regime
        # Range > 3%
        candles = [{"close": 100.0}] * 10 + [{"close": 105.0}] * 10
        assert volatility_regime(candles) == "high"

    def test_low_volatility(self):
        from src.main import volatility_regime
        # Range < 1%
        candles = [{"close": 100.0}] * 10 + [{"close": 100.5}] * 10
        assert volatility_regime(candles) == "low"

    def test_normal_volatility(self):
        from src.main import volatility_regime
        # Range between 1% and 3%
        candles = [{"close": 100.0}] * 10 + [{"close": 102.0}] * 10
        assert volatility_regime(candles) == "normal"

    def test_insufficient_data(self):
        from src.main import volatility_regime
        candles = [{"close": 100.0}] * 5
        assert volatility_regime(candles) == "normal"


# ─── Fallback Response ────────────────────────

class TestBuildFallback:
    def test_structure(self):
        from src.main import build_fallback
        result = build_fallback(
            symbol="AAPL", timeframe="15m", latest_price=150.0,
            trend="up", vol="normal",
            support=[148.0], resistance=[155.0],
            news_top3=["News1", "News2"], social_top3=["Social1"],
        )
        assert result["snapshot"]["symbol"] == "AAPL"
        assert result["snapshot"]["price"] == 150.0
        assert result["market_structure"]["trend"] == "up"
        assert len(result["scenarios"]) == 3
        assert result["suggested_action"]["action"] == "WATCH"
        assert len(result["disclosures"]) >= 1

    def test_probabilities_sum(self):
        from src.main import build_fallback
        result = build_fallback(
            symbol="X", timeframe="1h", latest_price=10.0,
            trend="range", vol="low",
            support=[], resistance=[],
            news_top3=[], social_top3=[],
        )
        total = sum(s["prob"] for s in result["scenarios"].values())
        assert total == 100

    def test_empty_catalysts(self):
        from src.main import build_fallback
        result = build_fallback(
            symbol="Y", timeframe="1d", latest_price=0.0,
            trend="down", vol="high",
            support=[], resistance=[],
            news_top3=[], social_top3=[],
        )
        assert result["catalysts"]["news_top3"] == []
        assert result["catalysts"]["social_top3"] == []


# ─── SKILL Contract ──────────────────────────

class TestSkillContract:
    def test_contract_exists(self):
        from src.skill_contract import TRADE_PLANNER_CONTRACT
        assert len(TRADE_PLANNER_CONTRACT) > 100

    def test_contract_contains_schema(self):
        from src.skill_contract import TRADE_PLANNER_CONTRACT
        assert "snapshot" in TRADE_PLANNER_CONTRACT
        assert "scenarios" in TRADE_PLANNER_CONTRACT
        assert "suggested_action" in TRADE_PLANNER_CONTRACT
        assert "disclosures" in TRADE_PLANNER_CONTRACT

    def test_contract_action_types(self):
        from src.skill_contract import TRADE_PLANNER_CONTRACT
        for action in ("WATCH", "BUY_ZONE", "REDUCE", "HEDGE", "AVOID"):
            assert action in TRADE_PLANNER_CONTRACT
