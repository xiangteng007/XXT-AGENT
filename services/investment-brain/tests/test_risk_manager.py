"""
Tests for Risk Manager — deterministic risk checks

These tests verify that ALL hard risk limits are enforced
by code, not by LLM. This is critical for financial safety.
"""
from __future__ import annotations

import pytest

from src.graph.nodes.risk_manager import (
    check_position_size,
    check_stop_loss_exists,
    check_risk_reward_ratio,
    check_daily_loss_limit,
    check_max_drawdown,
    check_concentration_risk,
)
from src.graph.state import InvestmentPlan, InvestmentAction


def _make_plan(**overrides) -> InvestmentPlan:
    """Helper to build a test plan."""
    default = InvestmentPlan(
        plan_id="test-plan",
        actions=[
            InvestmentAction(
                action="BUY",
                symbol="AAPL",
                allocation_pct=10,
                entry_price=180.0,
                stop_loss=170.0,
                take_profit=200.0,
                timeframe="1d",
                rationale="Test",
            )
        ],
        scenarios={},
        confidence=50,
        invalidation_rules=[],
        risk_flags=[],
        rationale="test plan",
    )
    default.update(overrides)
    return default


class TestPositionSize:
    def test_within_limit(self):
        plan = _make_plan()
        violations = check_position_size(plan, max_pct=20)
        assert violations == []

    def test_exceeds_limit(self):
        plan = _make_plan(actions=[
            InvestmentAction(action="BUY", symbol="AAPL", allocation_pct=25)
        ])
        violations = check_position_size(plan, max_pct=20)
        assert len(violations) == 1
        assert "超過上限" in violations[0]

    def test_at_limit(self):
        plan = _make_plan(actions=[
            InvestmentAction(action="BUY", symbol="AAPL", allocation_pct=20)
        ])
        violations = check_position_size(plan, max_pct=20)
        assert violations == []


class TestStopLossExists:
    def test_has_stop_loss(self):
        plan = _make_plan()
        violations = check_stop_loss_exists(plan)
        assert violations == []

    def test_missing_stop_loss(self):
        plan = _make_plan(actions=[
            InvestmentAction(action="BUY", symbol="AAPL", stop_loss=None)
        ])
        violations = check_stop_loss_exists(plan)
        assert len(violations) == 1
        assert "缺少停損" in violations[0]

    def test_watch_no_stop_loss_ok(self):
        plan = _make_plan(actions=[
            InvestmentAction(action="WATCH", symbol="AAPL", stop_loss=None)
        ])
        violations = check_stop_loss_exists(plan)
        assert violations == []  # WATCH doesn't need stop loss


class TestRiskReward:
    def test_good_ratio(self):
        plan = _make_plan(actions=[
            InvestmentAction(
                action="BUY", symbol="AAPL",
                entry_price=180, stop_loss=170, take_profit=200,
            )
        ])
        warnings = check_risk_reward_ratio(plan, min_ratio=1.5)
        assert warnings == []  # R:R = 20/10 = 2.0 > 1.5

    def test_bad_ratio(self):
        plan = _make_plan(actions=[
            InvestmentAction(
                action="BUY", symbol="AAPL",
                entry_price=180, stop_loss=170, take_profit=185,
            )
        ])
        warnings = check_risk_reward_ratio(plan, min_ratio=1.5)
        assert len(warnings) == 1
        assert "風報比不足" in warnings[0]


class TestDailyLoss:
    def test_within_limit(self):
        violations = check_daily_loss_limit(
            portfolio_daily_pnl_pct=-2.0,
            new_risk_pct=2.0,
            max_daily_loss_pct=5.0,
        )
        assert violations == []

    def test_would_exceed(self):
        violations = check_daily_loss_limit(
            portfolio_daily_pnl_pct=-4.0,
            new_risk_pct=3.0,
            max_daily_loss_pct=5.0,
        )
        assert len(violations) == 1
        assert "日損失限制" in violations[0]


class TestMaxDrawdown:
    def test_within_limit(self):
        violations = check_max_drawdown(10.0, 15.0)
        assert violations == []

    def test_at_limit(self):
        violations = check_max_drawdown(15.0, 15.0)
        assert len(violations) == 1
        assert "最大回撤限制" in violations[0]

    def test_exceeds_limit(self):
        violations = check_max_drawdown(20.0, 15.0)
        assert len(violations) == 1


class TestConcentration:
    def test_within_limit(self):
        plan = _make_plan(actions=[
            InvestmentAction(action="BUY", symbol="AAPL", allocation_pct=15),
            InvestmentAction(action="BUY", symbol="MSFT", allocation_pct=15),
        ])
        warnings = check_concentration_risk(plan, max_concentration_pct=40)
        assert warnings == []

    def test_exceeds_limit(self):
        plan = _make_plan(actions=[
            InvestmentAction(action="BUY", symbol="AAPL", allocation_pct=25),
            InvestmentAction(action="BUY", symbol="MSFT", allocation_pct=20),
        ])
        warnings = check_concentration_risk(plan, max_concentration_pct=40)
        assert len(warnings) == 1
        assert "集中度風險" in warnings[0]
