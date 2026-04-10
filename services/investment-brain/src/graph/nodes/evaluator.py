"""
Evaluator Agent Node (Feedback Loop)

Evaluates completed trade results using LLM-as-a-Judge pattern.
Produces reflections that update strategy memory for continuous improvement.

This is the core of the self-improving feedback loop:
  Observation → Reflection → Optimization → Validation
"""
from __future__ import annotations

import logging
from datetime import datetime

from langchain_core.messages import AIMessage

from ..state import InvestmentAgentState, StrategyMemory
from ...tools.ai_gateway import ai_gateway

logger = logging.getLogger("investment-brain.nodes.evaluator")

EVALUATOR_SYSTEM_PROMPT = """你是 XXT-AGENT 投資分析系統的「策略評估師」(Strategy Evaluator)。

你的職責是：
1. 回顧已完成的交易決策和結果
2. 判斷決策品質（不是只看結果，要看理由是否合理）
3. 識別成功和失敗的模式
4. 提出改進建議

以 JSON 格式輸出：
{
  "decision_quality": 0-100,
  "was_reasoning_sound": true/false,
  "successful_patterns": ["pattern1", "pattern2"],
  "failed_patterns": ["pattern1"],
  "improvements": ["improvement1", "improvement2"],
  "regime_insight": {
    "regime": "bull|bear|range|volatile",
    "preferred_strategy": "趨勢跟隨|均值回歸|波段操作|觀望",
    "confidence": 0-100
  },
  "summary": "一段繁體中文評估摘要"
}

規則：
- 區分「好決策壞結果」和「壞決策好結果」
- 如果止損被觸發但理由合理，仍可給高分
- 關注可重複的模式，而非單次運氣
- 使用繁體中文"""


async def evaluator_node(state: InvestmentAgentState) -> dict:
    """
    Evaluator Agent — LangGraph node function.

    Reviews trade results and updates strategy memory.
    Only runs when there are completed trade results.
    """
    symbol = state["symbol"]
    trade_results = state.get("trade_results", [])
    investment_plan = state.get("investment_plan")
    market_insight = state.get("market_insight")
    existing_memory = state.get("strategy_memory")

    logger.info(f"[Evaluator] Evaluating {len(trade_results)} trades for {symbol}")

    if not trade_results:
        return {
            "current_step": "complete",
            "messages": [AIMessage(
                content="[Evaluator] 無交易結果可評估",
                name="evaluator",
            )],
        }

    # ── Build evaluation prompt ────────────────────────────
    trades_text = ""
    for i, tr in enumerate(trade_results):
        trades_text += f"""
交易 #{i + 1}:
- 標的: {tr.get('symbol', symbol)}
- 動作: {tr.get('action', 'N/A')}
- 進場價: {tr.get('entry_price', 'N/A')}
- 出場價: {tr.get('exit_price', 'N/A')}
- 損益: {tr.get('pnl', 0):.2f} ({tr.get('pnl_pct', 0):.2f}%)
- 狀態: {tr.get('status', 'N/A')}
"""

    plan_text = ""
    if investment_plan:
        plan_text = f"""
原始計畫:
- 動作: {[a.get('action', '') for a in investment_plan.get('actions', [])]}
- 信心度: {investment_plan.get('confidence', 0)}
- 理由: {investment_plan.get('rationale', '')}
"""

    insight_text = ""
    if market_insight:
        insight_text = f"""
當時市場狀態:
- 體制: {market_insight.get('regime', 'unknown')}
- 趨勢: {market_insight.get('trend', 'range')}
- 信心度: {market_insight.get('conviction', 0)}
"""

    eval_prompt = f"""
評估以下投資決策的品質：

{trades_text}
{plan_text}
{insight_text}

請從「決策品質」而非「結果好壞」的角度評估。
"""

    # ── Call AI for evaluation ─────────────────────────────
    try:
        eval_data = await ai_gateway.generate_structured(
            prompt=eval_prompt,
            system_prompt=EVALUATOR_SYSTEM_PROMPT,
        )

        if eval_data.get("parse_error"):
            eval_data = _build_fallback_evaluation(trade_results)

    except Exception as e:
        logger.warning(f"[Evaluator] AI evaluation failed: {e}")
        eval_data = _build_fallback_evaluation(trade_results)

    # ── Update strategy memory ─────────────────────────────
    successful = eval_data.get("successful_patterns", [])
    failed = eval_data.get("failed_patterns", [])

    # Merge with existing memory
    if existing_memory:
        successful = list(set(existing_memory.get("successful_patterns", []) + successful))[-10:]
        failed = list(set(existing_memory.get("failed_patterns", []) + failed))[-10:]

    regime_prefs = {}
    if existing_memory:
        regime_prefs = existing_memory.get("regime_preferences", {})

    regime_insight = eval_data.get("regime_insight", {})
    if regime_insight.get("regime"):
        regime_prefs[regime_insight["regime"]] = regime_insight.get(
            "preferred_strategy", "觀望"
        )

    strategy_memory = StrategyMemory(
        successful_patterns=successful,
        failed_patterns=failed,
        regime_preferences=regime_prefs,
        last_updated=datetime.utcnow().isoformat(),
    )

    quality = eval_data.get("decision_quality", 50)
    summary = eval_data.get("summary", "評估完成")

    logger.info(f"[Evaluator] {symbol}: quality={quality}, patterns={len(successful)}+/{len(failed)}-")

    return {
        "strategy_memory": strategy_memory,
        "current_step": "complete",
        "completed_at": datetime.utcnow().isoformat(),
        "messages": [AIMessage(
            content=f"[Evaluator] {symbol} 策略評估: 品質={quality}/100. {summary}",
            name="evaluator",
        )],
    }


def _build_fallback_evaluation(trade_results: list[dict]) -> dict:
    """Basic evaluation when AI is unavailable."""
    total_pnl = sum(tr.get("pnl", 0) for tr in trade_results)
    win_count = sum(1 for tr in trade_results if tr.get("pnl", 0) > 0)

    return {
        "decision_quality": 50,
        "was_reasoning_sound": total_pnl >= 0,
        "successful_patterns": ["profit_trade"] if total_pnl > 0 else [],
        "failed_patterns": ["loss_trade"] if total_pnl < 0 else [],
        "improvements": ["需要更多數據才能識別模式"],
        "regime_insight": {},
        "summary": f"基礎評估: {win_count}/{len(trade_results)} 筆獲利, 總損益 {total_pnl:.2f}",
    }
