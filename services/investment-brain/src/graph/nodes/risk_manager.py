"""
Risk Manager Agent Node

CRITICAL DESIGN DECISION: All hard risk limits are enforced by
deterministic code, NOT by LLM. The AI is only used for anomaly
pattern detection as an advisory layer.

Hard Limits (configurable via env):
  - MAX_SINGLE_POSITION_PCT: 20% (default)
  - MAX_DAILY_LOSS_PCT: 5% (default)
  - MAX_DRAWDOWN_PCT: 15% (default)
"""
from __future__ import annotations

import logging

from langchain_core.messages import AIMessage

from ..state import InvestmentAgentState, RiskAssessment, InvestmentPlan
from ...config import settings

logger = logging.getLogger("investment-brain.nodes.risk_manager")


# ══════════════════════════════════════════════════════════════
# DETERMINISTIC RISK CHECKS — These NEVER use LLM
# ══════════════════════════════════════════════════════════════


def check_position_size(plan: InvestmentPlan, max_pct: float) -> list[str]:
    """Enforce maximum single position size."""
    violations = []
    for action in plan.get("actions", []):
        alloc = action.get("allocation_pct", 0)
        if alloc > max_pct:
            violations.append(
                f"持倉過大: {action.get('symbol', '?')} 配置 {alloc}% "
                f"超過上限 {max_pct}%"
            )
    return violations


def check_stop_loss_exists(plan: InvestmentPlan) -> list[str]:
    """Every BUY/HEDGE action MUST have a stop-loss."""
    violations = []
    for action in plan.get("actions", []):
        act = action.get("action", "")
        if act in ("BUY", "HEDGE", "REDUCE"):
            if action.get("stop_loss") is None:
                violations.append(
                    f"缺少停損: {action.get('symbol', '?')} 的 {act} "
                    f"動作未設定 stop_loss"
                )
    return violations


def check_risk_reward_ratio(plan: InvestmentPlan, min_ratio: float = 1.5) -> list[str]:
    """Risk/reward ratio must be at least 1.5:1."""
    warnings = []
    for action in plan.get("actions", []):
        entry = action.get("entry_price")
        stop = action.get("stop_loss")
        target = action.get("take_profit")

        if entry and stop and target and entry > 0 and stop > 0:
            risk = abs(entry - stop)
            reward = abs(target - entry)
            if risk > 0:
                ratio = reward / risk
                if ratio < min_ratio:
                    warnings.append(
                        f"風報比不足: {action.get('symbol', '?')} "
                        f"R:R = {ratio:.2f} (最低 {min_ratio})"
                    )
    return warnings


def check_daily_loss_limit(
    portfolio_daily_pnl_pct: float,
    new_risk_pct: float,
    max_daily_loss_pct: float,
) -> list[str]:
    """Prevent trades if daily loss limit would be exceeded."""
    violations = []
    worst_case = portfolio_daily_pnl_pct - new_risk_pct
    if worst_case < -max_daily_loss_pct:
        violations.append(
            f"日損失限制: 當日已損 {portfolio_daily_pnl_pct:.2f}%, "
            f"新風險 {new_risk_pct:.2f}% 將超過 {max_daily_loss_pct}% 上限"
        )
    return violations


def check_max_drawdown(
    current_drawdown_pct: float,
    max_drawdown_pct: float,
) -> list[str]:
    """Stop trading if max drawdown limit hit."""
    violations = []
    if current_drawdown_pct >= max_drawdown_pct:
        violations.append(
            f"最大回撤限制: 當前回撤 {current_drawdown_pct:.2f}% "
            f"已達上限 {max_drawdown_pct}%，禁止新開倉"
        )
    return violations


def check_concentration_risk(plan: InvestmentPlan, max_concentration_pct: float = 40) -> list[str]:
    """Total allocation to correlated assets should not exceed limit."""
    warnings = []
    total_alloc = sum(a.get("allocation_pct", 0) for a in plan.get("actions", []))
    if total_alloc > max_concentration_pct:
        warnings.append(
            f"集中度風險: 總配置 {total_alloc:.1f}% 超過 {max_concentration_pct}% 建議上限"
        )
    return warnings


# ══════════════════════════════════════════════════════════════
# RISK MANAGER NODE
# ══════════════════════════════════════════════════════════════


async def risk_manager_node(state: InvestmentAgentState) -> dict:
    """
    Risk Manager Agent — LangGraph node function.

    Executes deterministic risk checks on the InvestmentPlan.
    DOES NOT use LLM for hard limit enforcement.
    """
    plan = state.get("investment_plan")
    portfolio = state.get("portfolio")
    symbol = state["symbol"]

    logger.info(f"[Risk Manager] Reviewing plan for {symbol}")

    if not plan:
        return {
            "risk_assessment": RiskAssessment(
                approved=False,
                risk_score=100,
                adjustments=[],
                warnings=["無投資計畫可審核"],
                violations=["missing_plan"],
                adjusted_plan=None,
            ),
            "current_step": "error",
            "error": "No investment plan to review",
            "messages": [AIMessage(
                content="[Risk Manager] ❌ 無投資計畫可審核",
                name="risk_manager",
            )],
        }

    # ── Run all deterministic checks ───────────────────────
    all_violations: list[str] = []
    all_warnings: list[str] = []

    # 1. Position size
    all_violations.extend(
        check_position_size(plan, settings.max_single_position_pct)
    )

    # 2. Stop-loss requirement
    all_violations.extend(
        check_stop_loss_exists(plan)
    )

    # 3. Risk/reward ratio
    all_warnings.extend(
        check_risk_reward_ratio(plan)
    )

    # 4. Daily loss limit
    daily_pnl_pct = portfolio.get("daily_pnl_pct", 0) if portfolio else 0
    max_risk = max(
        (a.get("allocation_pct", 0) for a in plan.get("actions", [])),
        default=0,
    )
    all_violations.extend(
        check_daily_loss_limit(daily_pnl_pct, max_risk, settings.max_daily_loss_pct)
    )

    # 5. Max drawdown
    drawdown = portfolio.get("max_drawdown", 0) if portfolio else 0
    all_violations.extend(
        check_max_drawdown(drawdown, settings.max_drawdown_pct)
    )

    # 6. Concentration risk
    all_warnings.extend(
        check_concentration_risk(plan)
    )

    # ── Determine approval ─────────────────────────────────
    approved = len(all_violations) == 0
    risk_score = min(100, len(all_violations) * 30 + len(all_warnings) * 10)

    # ── Build adjustments for violations ───────────────────
    adjustments = []
    adjusted_plan = None

    if not approved:
        adjusted_plan = _auto_adjust_plan(plan, all_violations)
        for v in all_violations:
            adjustments.append({"type": "violation_fix", "description": v})

    # ── Build RiskAssessment ───────────────────────────────
    risk_assessment = RiskAssessment(
        approved=approved,
        risk_score=risk_score,
        adjustments=adjustments,
        warnings=all_warnings,
        violations=all_violations,
        adjusted_plan=adjusted_plan,
    )

    status = "✅ 通過" if approved else f"❌ 拒絕 ({len(all_violations)} 項違規)"
    next_step = "execute" if approved else "plan"  # Send back to planner if rejected

    # If rejected, cap retry at 1 (avoid infinite loop)
    if not approved and state.get("iteration", 0) >= 1:
        next_step = "complete"
        risk_assessment["approved"] = False

    logger.info(
        f"[Risk Manager] {symbol}: {status}, "
        f"risk_score={risk_score}, warnings={len(all_warnings)}"
    )

    return {
        "risk_assessment": risk_assessment,
        "investment_plan": adjusted_plan if adjusted_plan else plan,
        "current_step": next_step,
        "iteration": state.get("iteration", 0) + (0 if approved else 1),
        "messages": [AIMessage(
            content=f"[Risk Manager] {symbol}: {status}. "
                    + (f"違規: {'; '.join(all_violations[:3])}" if all_violations else "")
                    + (f" 警告: {'; '.join(all_warnings[:3])}" if all_warnings else ""),
            name="risk_manager",
        )],
    }


def _auto_adjust_plan(plan: InvestmentPlan, violations: list[str]) -> InvestmentPlan:
    """
    Automatically adjust plan to fix violations.
    Conservative approach: reduce positions or add missing stop-losses.
    """
    import copy
    adjusted = copy.deepcopy(plan)

    for action in adjusted.get("actions", []):
        # Fix position size
        if action.get("allocation_pct", 0) > settings.max_single_position_pct:
            action["allocation_pct"] = settings.max_single_position_pct

        # Add missing stop-loss (5% below entry by default)
        if action.get("action") in ("BUY", "HEDGE", "REDUCE"):
            if action.get("stop_loss") is None and action.get("entry_price"):
                action["stop_loss"] = round(action["entry_price"] * 0.95, 2)

    adjusted["risk_flags"] = list(set(
        adjusted.get("risk_flags", []) + ["auto_adjusted"]
    ))

    return adjusted
