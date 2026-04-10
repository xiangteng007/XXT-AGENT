"""
Investment Supervisor Graph

The main LangGraph state machine that orchestrates all investment agents.
Implements the flow: Analyze → Plan → Risk Check → Execute → Evaluate

Graph topology:
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ Market   │────▶│ Strategy │────▶│  Risk    │────▶│ Execute  │────▶│ Evaluate │
  │ Analyst  │     │ Planner  │     │ Manager  │     │(Sim/Skip)│     │(Optional)│
  └──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
                       ▲                │
                       └────────────────┘
                      (if rejected, retry once)
"""
from __future__ import annotations

import logging
from typing import Literal

from langgraph.graph import StateGraph, END

from .state import InvestmentAgentState
from .nodes.market_analyst import market_analyst_node
from .nodes.strategy_planner import strategy_planner_node
from .nodes.risk_manager import risk_manager_node
from .nodes.evaluator import evaluator_node

logger = logging.getLogger("investment-brain.graph.supervisor")


# ── Routing functions ──────────────────────────────────────


def route_after_risk_check(state: InvestmentAgentState) -> str:
    """Route based on risk assessment result."""
    step = state.get("current_step", "complete")

    if step == "execute":
        return "execute_node"
    elif step == "plan":
        # Rejected → retry planning (with adjustments)
        return "strategy_planner"
    else:
        # Error or max retries → complete
        return "complete_node"


def route_after_execute(state: InvestmentAgentState) -> str:
    """Route after execution: evaluate if we have results, else complete."""
    trade_results = state.get("trade_results", [])
    if trade_results:
        return "evaluator"
    return "complete_node"


# ── Execution placeholder ─────────────────────────────────
# In Phase 1, execution returns immediately.
# Phase 2 will integrate the Simulation Engine.


async def execute_node(state: InvestmentAgentState) -> dict:
    """
    Execution node — placeholder for Phase 2 Simulation Engine.

    In Phase 1: Logs the approved plan and marks complete.
    In Phase 2: Sends to Simulation Engine for paper trading.
    """
    from langchain_core.messages import AIMessage

    plan = state.get("investment_plan")
    symbol = state["symbol"]

    logger.info(f"[Executor] Plan approved for {symbol} — simulation pending Phase 2")

    # Phase 1: No actual execution, just log
    return {
        "current_step": "complete",
        "trade_results": [],  # Will be filled by Simulation Engine in Phase 2
        "messages": [AIMessage(
            content=f"[Executor] {symbol} 計畫已通過風控審核。"
                    f"模擬交易引擎待 Phase 2 實裝。"
                    f"計畫: {[a.get('action', '') + ' ' + a.get('symbol', '') for a in (plan or {}).get('actions', [])]}",
            name="executor",
        )],
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
    graph.add_node("strategy_planner", strategy_planner_node)
    graph.add_node("risk_manager", risk_manager_node)
    graph.add_node("execute_node", execute_node)
    graph.add_node("evaluator", evaluator_node)
    graph.add_node("complete_node", complete_node)

    # ── Define edges ───────────────────────────────────────

    # Entry point
    graph.set_entry_point("market_analyst")

    # Market Analyst → Strategy Planner (always)
    graph.add_edge("market_analyst", "strategy_planner")

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
