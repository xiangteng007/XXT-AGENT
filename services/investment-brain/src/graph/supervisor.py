"""
Investment Supervisor Graph

The main LangGraph state machine that orchestrates all investment agents.
Implements the flow: Analyze → Verify → Plan → Risk Check → Execute → Evaluate

Graph topology:
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ Market   │────▶│ Info     │────▶│ Strategy │────▶│  Risk    │────▶│ Execute  │────▶│ Evaluate │
  │ Analyst  │     │ Verifier │     │ Planner  │     │ Manager  │     │(Sim/Skip)│     │(Optional)│
  └──────────┘     │ (Argus)  │     └──────────┘     └──────────┘     └──────────┘     └──────────┘
                   └──────────┘          ▲                │
                                         └────────────────┘
                                        (if rejected, retry once)
"""
from __future__ import annotations

import logging
from typing import Literal

from langgraph.graph import StateGraph, END

from .state import InvestmentAgentState
from .nodes.market_analyst import market_analyst_node
from .nodes.information_verifier import information_verifier_node
from .nodes.strategy_planner import strategy_planner_node
from .nodes.risk_manager import risk_manager_node
from .nodes.evaluator import evaluator_node

logger = logging.getLogger("investment-brain.graph.supervisor")


# ── Routing functions ──────────────────────────────────────


def route_after_risk_check(state: InvestmentAgentState) -> str:
    """
    Route based on risk assessment result.

    P1-03: Enforces max_iterations guard to prevent infinite loops.
    Even if `iteration` is corrupted (e.g. Redis deserialization failure),
    the guard defaults to capping at 2 retries.
    """
    step = state.get("current_step", "complete")
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 2)

    # Safety: if iteration is not an int (corruption), force-complete
    if not isinstance(iteration, int):
        logger.warning(f"[Supervisor] iteration is corrupted ({iteration!r}), forcing complete")
        return "complete_node"

    if step == "execute":
        return "execute_node"
    elif step == "plan":
        if iteration >= max_iterations:
            logger.warning(
                f"[Supervisor] Max iterations ({max_iterations}) reached, "
                f"forcing complete instead of retry"
            )
            return "complete_node"
        return "strategy_planner"
    else:
        return "complete_node"


def route_after_execute(state: InvestmentAgentState) -> str:
    """Route after execution: evaluate if we have results, else complete."""
    trade_results = state.get("trade_results", [])
    if trade_results:
        return "evaluator"
    return "complete_node"


# ── Execution with Simulation Engine ──────────────────────────


async def execute_node(state: InvestmentAgentState) -> dict:
    """
    Execution node — routes to appropriate execution mode.

    - advisory: Log plan, return immediately (no trades)
    - paper_trade: Execute via SimulationEngine (virtual portfolio)
    - live: Not yet implemented (Phase 4)
    """
    from langchain_core.messages import AIMessage
    from ..simulation import SimulationEngine
    from ..tools.market_data import market_data
    from ..config import settings

    plan = state.get("investment_plan")
    risk = state.get("risk_assessment")
    symbol = state["symbol"]
    mode = state.get("execution_mode", "advisory")

    actions = (plan or {}).get("actions", [])
    action_summary = [f"{a.get('action', '?')} {a.get('symbol', '?')}" for a in actions]
    risk_approved = risk.get("approved", False) if isinstance(risk, dict) else False

    logger.info(
        f"[Executor] Plan for {symbol} — mode={mode}, "
        f"actions={action_summary}, risk_approved={risk_approved}"
    )

    if mode == "advisory":
        advisory = (plan or {}).get("advisory_disclaimer", "此為分析建議，非交易指令。")
        return {
            "current_step": "complete",
            "trade_results": [],
            "messages": [AIMessage(
                content=f"[Executor] 模式: 投資建議 (Advisory)\n"
                        f"{symbol} 計畫已通過風控審核。\n"
                        f"⚠️ {advisory}\n"
                        f"計畫: {action_summary}",
                name="executor",
            )],
        }
    
    elif mode == "paper_trade":
        # Execute via SimulationEngine
        sim = SimulationEngine(redis_url=settings.redis_url)
        trade_results = []

        for action_item in actions:
            act = action_item.get("action", "WATCH").upper()
            act_symbol = action_item.get("symbol", symbol)
            entry_price = action_item.get("entry_price", 0)
            alloc_pct = action_item.get("allocation_pct", 5)

            # Skip non-tradeable actions
            if act in ("WATCH", "HOLD", "AVOID"):
                trade_results.append({
                    "action": act,
                    "symbol": act_symbol,
                    "status": "skipped",
                    "reason": f"{act} 不執行交易",
                })
                continue

            # If no entry price, try to get current quote
            if not entry_price or entry_price <= 0:
                quote = await market_data.get_quote(act_symbol)
                if quote:
                    entry_price = quote.get("price", 0)

            if entry_price <= 0:
                trade_results.append({
                    "action": act,
                    "symbol": act_symbol,
                    "status": "failed",
                    "reason": "無法取得報價",
                })
                continue

            # Calculate shares from allocation percentage
            portfolio = await sim.get_portfolio()
            alloc_amount = portfolio.total_value * (alloc_pct / 100)
            shares = int(alloc_amount / entry_price)

            if shares <= 0:
                trade_results.append({
                    "action": act,
                    "symbol": act_symbol,
                    "status": "failed",
                    "reason": "資金不足",
                })
                continue

            # Execute virtual trade
            sim_action = "BUY" if act in ("BUY", "HEDGE") else "SELL"
            trade = await sim.execute_order(sim_action, act_symbol, shares, entry_price)
            trade_results.append({
                **trade.to_dict(),
                "status": "executed",
                "allocation_pct": alloc_pct,
            })

        # Get updated portfolio
        portfolio = await sim.get_portfolio()
        await sim.close()

        result_summary = "; ".join(
            f"{r.get('action')} {r.get('symbol')} → {r.get('status')}"
            for r in trade_results
        )

        return {
            "current_step": "complete",
            "trade_results": trade_results,
            "messages": [AIMessage(
                content=f"[Executor] 模式: 模擬交易 (Paper Trade)\n"
                        f"{symbol} 計畫已在模擬引擎中執行。\n"
                        f"結果: {result_summary}\n"
                        f"💰 虛擬帳戶: NT${portfolio.total_value:,.0f} "
                        f"(現金 NT${portfolio.cash:,.0f}, "
                        f"持倉 {len(portfolio.positions)} 檔)",
                name="executor",
            )],
        }
        
    elif mode == "live":
        return {
            "current_step": "complete",
            "trade_results": [],
            "messages": [AIMessage(
                content=f"[Executor] 模式: 實盤交易 (Live)\n"
                        f"⚠️ {symbol} 實盤交易請求已記錄。目前即時交易模組尚未啟用 (Phase 4)。\n"
                        f"計畫: {action_summary}",
                name="executor",
            )],
        }
    
    else:
        # Fallback
        return {
            "current_step": "complete",
            "messages": [AIMessage(content=f"[Executor] 未知執行模式: {mode}", name="executor")]
        }

async def complete_node(state: InvestmentAgentState) -> dict:
    """Final node — marks the session as complete."""
    from langchain_core.messages import AIMessage
    from datetime import datetime

    return {
        "current_step": "complete",
        "completed_at": datetime.utcnow().isoformat(),
        "messages": [AIMessage(
            content=f"[Director] 分析完成: {state['symbol']}",
            name="director",
        )],
    }


# ── Build the graph ────────────────────────────────────────


def build_investment_graph() -> StateGraph:
    """
    Build and compile the investment supervisor graph.

    Returns a compiled LangGraph that can be invoked with:
        result = await graph.ainvoke(initial_state)
    """
    graph = StateGraph(InvestmentAgentState)

    # ── Add nodes ──────────────────────────────────────────
    graph.add_node("market_analyst", market_analyst_node)
    graph.add_node("information_verifier", information_verifier_node)
    graph.add_node("strategy_planner", strategy_planner_node)
    graph.add_node("risk_manager", risk_manager_node)
    graph.add_node("execute_node", execute_node)
    graph.add_node("evaluator", evaluator_node)
    graph.add_node("complete_node", complete_node)

    # ── Define edges ───────────────────────────────────────

    # Entry point
    graph.set_entry_point("market_analyst")

    # Market Analyst → Information Verifier (always)
    graph.add_edge("market_analyst", "information_verifier")

    # Information Verifier → Strategy Planner (always)
    graph.add_edge("information_verifier", "strategy_planner")

    # Strategy Planner → Risk Manager (always)
    graph.add_edge("strategy_planner", "risk_manager")

    # Risk Manager → conditional routing
    graph.add_conditional_edges(
        "risk_manager",
        route_after_risk_check,
        {
            "execute_node": "execute_node",
            "strategy_planner": "strategy_planner",
            "complete_node": "complete_node",
        },
    )

    # Execute → conditional (evaluate if results, else complete)
    graph.add_conditional_edges(
        "execute_node",
        route_after_execute,
        {
            "evaluator": "evaluator",
            "complete_node": "complete_node",
        },
    )

    # Evaluator → complete (always)
    graph.add_edge("evaluator", "complete_node")

    # Complete → END
    graph.add_edge("complete_node", END)

    return graph.compile()


# ── Singleton compiled graph ───────────────────────────────
investment_graph = build_investment_graph()
