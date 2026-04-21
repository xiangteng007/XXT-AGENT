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
from ...tools.market_data import market_data
from ...backtest_engine import BacktestEngine

logger = logging.getLogger("investment-brain.nodes.strategy_planner")

STRATEGY_PLANNER_SYSTEM_PROMPT = """你是 XXT-AGENT 投資分析系統的「策略規劃師」(Strategy Planner)。

【強制規則】你的輸出為投資分析建議（Advisory），非交易指令（Order）。
每個 action 必須附帶 rationale（判斷依據）和明確的 entry_price / stop_loss / take_profit。
禁止在 rationale 欄位使用「執行」「下單」「立即買入」等行動性語言。
使用「建議」「評估」「參考進場區間」等框架性語言。

⚠️ 核心原則（不可違反）：
1. 你的所有輸出均為「分析建議」(Analysis Advice)，不是交易指令
2. 任何建議必須附帶明確的判斷依據（judgment_basis）
3. 目標價格必須有具體推導邏輯（不可僅給出數字）
4. 永遠不可使用「立即買入」「馬上賣出」等行動性語言，改用「建議觀察買入區間」「可考慮分批減倉」

你的職責是：
1. 根據市場分析師的 MarketInsight 制定投資建議方案
2. 考慮用戶的風險偏好（conservative / moderate / aggressive）
3. 定義明確的觀察區間和失效條件
4. 提供多情境概率評估
5. 所有數字必須有推導邏輯

以 JSON 格式輸出：
{
  "actions": [
    {
      "action": "BUY|SELL|HOLD|WATCH|HEDGE|REDUCE|AVOID",
      "symbol": "AAPL",
      "allocation_pct": 10.0,
      "entry_price": 180.0,
      "entry_rationale": "根據 [具體技術指標/支撐位/均線] 推導的建議進場觀察區間",
      "stop_loss": 175.0,
      "stop_loss_rationale": "跌破 [具體支撐位/前低] 即失效",
      "take_profit": 195.0,
      "take_profit_rationale": "接近 [具體壓力位/前高/黃金比率目標]",
      "timeframe": "1-3d",
      "rationale": "綜合判斷原因（繁體中文），不使用行動性語言",
      "basis_of_judgment": "本建議的具體支撐數據（如: 技術指標、事件）"
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
  "rationale": "整體策略說明（繁體中文）",
  "judgment_basis": "本建議依據以下分析形成：1) [技術面數據] 2) [基本面事件] 3) [情緒面訊號]",
  "advisory_disclaimer": "本分析僅供參考，不構成投資建議。投資人應自行評估風險。"
}

規則：
- 保守型: 單一持倉 ≤ 10%, 偏好 WATCH/HOLD
- 穩健型: 單一持倉 ≤ 15%, 偏好 WATCH/BUY_ZONE
- 積極型: 單一持倉 ≤ 20%, 可 BUY/HEDGE
- 至少 2 條 invalidation_rules
- 三情境概率總和 ≈ 100
- judgment_basis 為必填欄位
- entry_rationale、stop_loss_rationale、take_profit_rationale 為必填
- 使用繁體中文
- 所有價格目標必須標註推導來源（技術指標名稱或歷史水位）"""

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
    verification_insight = state.get("verification_insight")
    price_snapshot = state.get("price_snapshot")
    strategy_memory = state.get("strategy_memory")

    logger.info(f"[Strategy Planner] Planning for {symbol} (risk={risk_level})")

    # ── Step 0: Backtest Engine Integration ────────────────
    backtest_metrics = {}
    try:
        candles = await market_data.get_candles(symbol, interval="1d", range_str="1y")
        # Ensure it is formatted for BacktestEngine
        # market_data.get_candles returns: {"timestamp":..., "datetime":..., "open":..., "high":..., "low":..., "close":..., "volume":...}
        # BacktestEngine expects: {"date":..., "close":...}
        bt_data = [{"date": c["datetime"], "close": c["close"]} for c in candles]
        
        engine = BacktestEngine(risk_free_rate=0.02)
        backtest_metrics = engine.calculate_metrics(bt_data)
        logger.info(f"[Strategy Planner] Backtest metrics computed for {symbol}")
    except Exception as e:
        logger.warning(f"[Strategy Planner] Backtest Engine unavailable: {e}")

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

    verification_text = ""
    if verification_insight:
        verification_text = f"""
OSINT 資訊驗證員報告:
- 可信度: {'高' if verification_insight.get('is_credible') else '低 (潛在假消息/過度炒作)'}
- 情緒背離: {'有背離現象' if verification_insight.get('sentiment_divergence') else '無背離'}
- 確認催化劑: {', '.join(verification_insight.get('verified_catalysts', []))}
- 炒作/假消息警告: {', '.join(verification_insight.get('fake_or_hype_warnings', []))}
- 摘要: {verification_insight.get('summary', '')}

特別指示：如果可信度低或有情緒背離，必須降低單一持倉上限或偏向 WATCH/HEDGE。
"""

    memory_text = ""
    if strategy_memory:
        if strategy_memory.get("successful_patterns"):
            memory_text += f"\n歷史成功模式: {', '.join(strategy_memory['successful_patterns'][:3])}"
        if strategy_memory.get("failed_patterns"):
            memory_text += f"\n歷史失敗模式（避免）: {', '.join(strategy_memory['failed_patterns'][:3])}"

    backtest_text = ""
    if backtest_metrics and "error" not in backtest_metrics:
        backtest_text = f"""
Backtest Engine 歷史回測表現 (過去 1 年基準):
- 總報酬率: {backtest_metrics.get('total_return', 0) * 100:.2f}%
- 年化報酬率: {backtest_metrics.get('annualized_return', 0) * 100:.2f}%
- 年化波動率: {backtest_metrics.get('annualized_volatility', 0) * 100:.2f}%
- 夏普值 (Sharpe): {backtest_metrics.get('sharpe_ratio', 0):.2f}
- 最大回撤 (Max Drawdown): {backtest_metrics.get('max_drawdown', 0) * 100:.2f}%
"""

    planning_prompt = f"""
標的: {symbol}
時間框架: {timeframe}
風險偏好: {risk_level}
最大單一持倉: {risk_config['max_pct']}%
偏好動作類型: {risk_config['preferred']}

{insight_text}
{verification_text}
{baseline_text}
{memory_text}
{backtest_text}

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
            basis_of_judgment=a.get("basis_of_judgment", "無具體依據提供"),
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
                "basis_of_judgment": "無",
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
