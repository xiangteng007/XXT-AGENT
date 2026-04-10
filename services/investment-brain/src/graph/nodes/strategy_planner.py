"""
Strategy Planner Agent Node

Takes MarketInsight and user preferences to generate an InvestmentPlan
with specific actions, entry/exit rules, and probability scenarios.

Integration:
  - Trade Planner Worker (existing SKILL contract)
  - AI Gateway (extended analysis)
"""
from __future__ import annotations

import logging
import uuid

from langchain_core.messages import AIMessage

from ..state import InvestmentAgentState, InvestmentPlan, InvestmentAction
from ...tools.ai_gateway import ai_gateway
from ...tools.trade_planner import trade_planner

logger = logging.getLogger("investment-brain.nodes.strategy_planner")

STRATEGY_PLANNER_SYSTEM_PROMPT = """你是 XXT-AGENT 投資分析系統的「策略規劃師」(Strategy Planner)。

你的職責是：
1. 根據市場分析師的 MarketInsight 制定投資計畫
2. 考慮用戶的風險偏好（conservative / moderate / aggressive）
3. 定義明確的進出場規則和失效條件
4. 提供多情境概率評估

以 JSON 格式輸出：
{
  "actions": [
    {
      "action": "BUY|SELL|HOLD|WATCH|HEDGE|REDUCE|AVOID",
      "symbol": "AAPL",
      "allocation_pct": 10.0,
      "entry_price": 180.0,
      "stop_loss": 175.0,
      "take_profit": 195.0,
      "timeframe": "1-3d",
      "rationale": "原因（繁體中文）"
    }
  ],
  "scenarios": {
    "base": {"path": "最可能情境", "prob": 55},
    "bull": {"path": "樂觀情境", "prob": 25},
    "bear": {"path": "悲觀情境", "prob": 20}
  },
  "confidence": 0-100,
  "invalidation_rules": ["失效條件 1", "失效條件 2"],
  "risk_flags": ["high_vol", "news_uncertainty", "thin_liquidity"],
  "rationale": "整體策略說明（繁體中文）"
}

規則：
- 保守型: 單一持倉 ≤ 10%, 偏好 WATCH/HOLD
- 穩健型: 單一持倉 ≤ 15%, 偏好 WATCH/BUY_ZONE
- 積極型: 單一持倉 ≤ 20%, 可 BUY/HEDGE
- 至少 2 條 invalidation_rules
- 三情境概率總和 ≈ 100
- 使用繁體中文"""

RISK_ALLOCATION = {
    "conservative": {"max_pct": 10, "preferred": ["WATCH", "HOLD"]},
    "moderate": {"max_pct": 15, "preferred": ["WATCH", "BUY", "HOLD"]},
    "aggressive": {"max_pct": 20, "preferred": ["BUY", "HEDGE", "REDUCE"]},
}


async def strategy_planner_node(state: InvestmentAgentState) -> dict:
    """
    Strategy Planner Agent — LangGraph node function.

    1. Retrieves MarketInsight from state
    2. Calls Trade Planner Worker for baseline plan
    3. Enriches with AI Gateway for user-specific strategy
    4. Returns InvestmentPlan
    """
    symbol = state["symbol"]
    timeframe = state.get("timeframe", "1h")
    risk_level = state.get("risk_level", "moderate")
    market_insight = state.get("market_insight")
    price_snapshot = state.get("price_snapshot")
    strategy_memory = state.get("strategy_memory")

    logger.info(f"[Strategy Planner] Planning for {symbol} (risk={risk_level})")

    # ── Step 1: Get baseline from Trade Planner Worker ─────
    baseline_plan = {}
    try:
        baseline_plan = await trade_planner.analyze(symbol, timeframe)
    except Exception as e:
        logger.warning(f"[Strategy Planner] Trade Planner unavailable: {e}")

    # ── Step 2: Build enriched prompt ──────────────────────
    risk_config = RISK_ALLOCATION.get(risk_level, RISK_ALLOCATION["moderate"])

    insight_text = ""
    if market_insight:
        insight_text = f"""
市場分析師報告:
- 體制: {market_insight.get('regime', 'unknown')}
- 趨勢: {market_insight.get('trend', 'range')}
- 信心度: {market_insight.get('conviction', 0)}/100
- 關鍵水位: {market_insight.get('key_levels', {})}
- 催化劑: {', '.join(market_insight.get('catalysts', []))}
- 摘要: {market_insight.get('summary', '')}
"""

    baseline_text = ""
    if baseline_plan:
        baseline_text = f"""
Trade Planner Worker 基準計畫:
- 建議動作: {baseline_plan.get('suggested_action', {}).get('action', 'N/A')}
- 信心度: {baseline_plan.get('suggested_action', {}).get('confidence', 0)}
- 情境: {baseline_plan.get('scenarios', {})}
"""

    memory_text = ""
    if strategy_memory:
        if strategy_memory.get("successful_patterns"):
            memory_text += f"\n歷史成功模式: {', '.join(strategy_memory['successful_patterns'][:3])}"
        if strategy_memory.get("failed_patterns"):
            memory_text += f"\n歷史失敗模式（避免）: {', '.join(strategy_memory['failed_patterns'][:3])}"

    planning_prompt = f"""
標的: {symbol}
時間框架: {timeframe}
風險偏好: {risk_level}
最大單一持倉: {risk_config['max_pct']}%
偏好動作類型: {risk_config['preferred']}

{insight_text}
{baseline_text}
{memory_text}

目前價格: {price_snapshot.get('price', 0) if price_snapshot else '不可用'}

請根據以上資訊制定投資計畫。
"""

    # ── Step 3: Call AI Gateway ─────────────────────────────
    try:
        plan_data = await ai_gateway.generate_structured(
            prompt=planning_prompt,
            system_prompt=STRATEGY_PLANNER_SYSTEM_PROMPT,
        )

        if plan_data.get("parse_error"):
            plan_data = _build_fallback_plan(symbol, timeframe, risk_level, market_insight, baseline_plan)

    except Exception as e:
        logger.warning(f"[Strategy Planner] AI Gateway failed: {e}, using fallback")
        plan_data = _build_fallback_plan(symbol, timeframe, risk_level, market_insight, baseline_plan)

    # ── Step 4: Build InvestmentPlan ───────────────────────
    actions = []
    for a in plan_data.get("actions", []):
        actions.append(InvestmentAction(
            action=a.get("action", "WATCH"),
            symbol=a.get("symbol", symbol),
            allocation_pct=min(a.get("allocation_pct", 0), risk_config["max_pct"]),
            entry_price=a.get("entry_price"),
            stop_loss=a.get("stop_loss"),
            take_profit=a.get("take_profit"),
            timeframe=a.get("timeframe", timeframe),
            rationale=a.get("rationale", ""),
        ))

    investment_plan = InvestmentPlan(
        plan_id=f"plan-{uuid.uuid4().hex[:8]}",
        actions=actions,
        scenarios=plan_data.get("scenarios", {}),
        confidence=plan_data.get("confidence", 30),
        invalidation_rules=plan_data.get("invalidation_rules", []),
        risk_flags=plan_data.get("risk_flags", []),
        rationale=plan_data.get("rationale", ""),
    )

    logger.info(
        f"[Strategy Planner] {symbol}: {len(actions)} actions, "
        f"confidence={investment_plan['confidence']}"
    )

    return {
        "investment_plan": investment_plan,
        "current_step": "risk_check",
        "messages": [AIMessage(
            content=f"[Strategy Planner] {symbol} 計畫完成: "
                    f"{len(actions)} 個動作, "
                    f"信心度 {investment_plan['confidence']}/100. "
                    f"{investment_plan['rationale'][:100]}",
            name="strategy_planner",
        )],
    }


def _build_fallback_plan(
    symbol: str,
    timeframe: str,
    risk_level: str,
    market_insight: dict | None,
    baseline: dict,
) -> dict:
    """Build a conservative fallback plan when AI is unavailable."""
    action = "WATCH"
    if baseline:
        action = baseline.get("suggested_action", {}).get("action", "WATCH")

    return {
        "actions": [
            {
                "action": action,
                "symbol": symbol,
                "allocation_pct": 0,
                "entry_price": None,
                "stop_loss": None,
                "take_profit": None,
                "timeframe": timeframe,
                "rationale": "AI 服務暫時不可用，建議觀察等待",
            }
        ],
        "scenarios": {
            "base": {"path": "維持觀察", "prob": 60},
            "bull": {"path": "等待確認訊號", "prob": 20},
            "bear": {"path": "持續觀察風險", "prob": 20},
        },
        "confidence": 25,
        "invalidation_rules": ["當 AI 服務恢復時重新分析", "監控價格異常波動"],
        "risk_flags": ["ai_unavailable"],
        "rationale": "由於 AI 分析服務暫時不可用，採取保守觀望策略",
    }
