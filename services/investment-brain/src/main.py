"""
Investment Brain — Main Entry Point

FastAPI service that exposes the LangGraph investment agent system.
Provides REST endpoints for investment analysis, portfolio management,
and integration with the OpenClaw Gateway.

Endpoints:
  GET  /health              Health check
  POST /invest/analyze      Run full analysis pipeline
  GET  /invest/status/:id   Get session status
  POST /invest/simulate     Trigger simulation (Phase 2)
  GET  /invest/portfolio    Get virtual portfolio state
"""
from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import settings
from .graph.state import create_initial_state
from .graph.supervisor import investment_graph
from .session_store import RedisSessionStore
from .tools.ai_gateway import ai_gateway
from .tools.fusion_client import fusion_client
from .tools.trade_planner import trade_planner
from .tools.market_data import market_data

# ── Logging ────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("investment-brain")


# ── Session store (A-1 / P2: Redis backend, in-memory fallback) ──
_session_ttl = int(os.getenv("SESSION_TTL_SECONDS", "86400"))
session_store = RedisSessionStore(
    redis_url=settings.redis_url,
    ttl_seconds=_session_ttl,
)


# ── Lifecycle ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Investment Brain starting up...")
    logger.info(f"  AI Gateway: {settings.ai_gateway_url}")
    logger.info(f"  Trade Planner: {settings.trade_planner_url}")
    logger.info(f"  Risk limits: pos={settings.max_single_position_pct}%, "
                f"daily={settings.max_daily_loss_pct}%, "
                f"drawdown={settings.max_drawdown_pct}%")
    # A-1: 初始化 Redis session store
    await session_store.connect()
    logger.info(f"  Session backend: {session_store.backend}")
    yield
    # Cleanup
    await session_store.close()
    await ai_gateway.close()
    await fusion_client.close()
    await trade_planner.close()
    await market_data.close()
    logger.info("Investment Brain shut down")


# ── FastAPI App ────────────────────────────────────────────
app = FastAPI(
    title="XXT-AGENT Investment Brain",
    description="Multi-Agent Investment Intelligence System powered by LangGraph",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3100",
        "https://xxt-agent-dashboard.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response Models ────────────────────────────────


class AnalyzeRequest(BaseModel):
    symbol: str = Field(..., description="Stock symbol (e.g., AAPL, TSLA)")
    timeframe: str = Field(default="1h", description="Analysis timeframe")
    risk_level: str = Field(
        default="moderate",
        description="Risk preference: conservative, moderate, aggressive",
    )
    user_context: str | None = Field(
        default=None,
        description="Additional user instructions",
    )
    run_simulation: bool = Field(
        default=False,
        description="Whether to run paper trading simulation",
    )


class AnalyzeResponse(BaseModel):
    session_id: str
    symbol: str
    status: str
    market_insight: dict | None = None
    investment_plan: dict | None = None
    risk_assessment: dict | None = None
    trade_results: list[dict] = []
    portfolio: dict | None = None
    strategy_memory: dict | None = None
    messages: list[str] = []
    started_at: str
    completed_at: str | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    graph_nodes: list[str]
    risk_limits: dict
    active_sessions: int
    timestamp: str


# ── Endpoints ──────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        service="investment-brain",
        version="0.1.0",
        graph_nodes=[
            "market_analyst",
            "strategy_planner",
            "risk_manager",
            "execute_node",
            "evaluator",
        ],
        risk_limits={
            "max_single_position_pct": settings.max_single_position_pct,
            "max_daily_loss_pct": settings.max_daily_loss_pct,
            "max_drawdown_pct": settings.max_drawdown_pct,
        },
        active_sessions=await session_store.count(),
        timestamp=datetime.utcnow().isoformat(),
    )


@app.post("/invest/analyze", response_model=AnalyzeResponse)
async def analyze_investment(req: AnalyzeRequest):
    """
    Run the full investment analysis pipeline.

    Flow: Market Analyst → Strategy Planner → Risk Manager → (Execute) → (Evaluate)
    """
    session_id = str(uuid.uuid4())
    symbol = req.symbol.upper().strip()

    if not symbol:
        raise HTTPException(status_code=400, detail="symbol is required")

    logger.info(f"[API] Starting analysis: {symbol} (session={session_id[:8]})")

    # Create initial state
    initial_state = create_initial_state(
        symbol=symbol,
        timeframe=req.timeframe,
        risk_level=req.risk_level,
        user_context=req.user_context,
        session_id=session_id,
    )

    # Run the graph
    try:
        result = await investment_graph.ainvoke(initial_state)
    except Exception as e:
        logger.error(f"[API] Graph execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    # Extract messages as strings
    message_strs = []
    for msg in result.get("messages", []):
        if hasattr(msg, "content"):
            message_strs.append(msg.content)

    # Store session in Redis (A-1)
    session_data = {
        "session_id": session_id,
        "symbol": symbol,
        "result": result,
        "completed_at": datetime.utcnow().isoformat(),
    }
    await session_store.set(session_id, session_data)

    # Build response
    response = AnalyzeResponse(
        session_id=session_id,
        symbol=symbol,
        status=result.get("current_step", "complete"),
        market_insight=result.get("market_insight"),
        investment_plan=result.get("investment_plan"),
        risk_assessment=result.get("risk_assessment"),
        trade_results=result.get("trade_results", []),
        portfolio=result.get("portfolio"),
        strategy_memory=result.get("strategy_memory"),
        messages=message_strs,
        started_at=result.get("started_at", ""),
        completed_at=result.get("completed_at"),
        error=result.get("error"),
    )

    logger.info(
        f"[API] Analysis complete: {symbol} (session={session_id[:8]}), "
        f"status={response.status}"
    )

    return response


@app.get("/invest/status/{session_id}")
async def get_session_status(session_id: str):
    """Get the status of a previous analysis session."""
    session = await session_store.get(session_id)           # A-1
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = session["result"]
    return {
        "session_id": session_id,
        "symbol": session["symbol"],
        "status": result.get("current_step", "complete"),
        "completed_at": session.get("completed_at"),
        "session_backend": session_store.backend,          # A-1: 顯示 backend 供診斷
    }


@app.get("/invest/portfolio")
async def get_portfolio():
    """Get the current virtual portfolio state (Phase 2)."""
    return {
        "status": "pending",
        "message": "虛擬投組功能將於 Phase 2 實裝",
        "portfolio": {
            "total_value": 100000.0,
            "cash": 100000.0,
            "positions": [],
            "daily_pnl": 0,
            "daily_pnl_pct": 0,
            "max_drawdown": 0,
            "sharpe_ratio": None,
            "win_rate": None,
            "total_trades": 0,
        },
    }


@app.get("/invest/sessions")
async def list_sessions():
    """List recent analysis sessions."""
    recent = await session_store.list_recent(limit=20)      # A-1
    return {
        "sessions": [
            {
                "session_id": s["session_id"],
                "symbol": s["symbol"],
                "completed_at": s.get("completed_at"),
            }
            for s in recent
        ],
        "total": await session_store.count(),
        "backend": session_store.backend,                   # A-1: 診斷資訊
    }


# ── Run with uvicorn ───────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
