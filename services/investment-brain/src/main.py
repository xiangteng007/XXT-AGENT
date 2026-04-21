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

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
try:
    from importlib.metadata import version as pkg_version
    _APP_VERSION = pkg_version("investment-brain")
except Exception:
    _APP_VERSION = "0.1.0"

from .config import settings
from .graph.state import create_initial_state
from .graph.supervisor import investment_graph
from .session_store import RedisSessionStore
from .memory.strategy_store import StrategyMemoryStore   # F-01
from .tools.ai_gateway import ai_gateway
from .tools.fusion_client import fusion_client
from .tools.trade_planner import trade_planner
from .tools.market_data import market_data

from .fugle_client import FugleClient
from .backtest_engine import BacktestEngine

fugle_client = FugleClient()
backtest_engine = BacktestEngine()
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

# F-01: Cross-session strategy memory store
_strategy_mem_ttl = int(os.getenv("STRATEGY_MEMORY_TTL_SECONDS", "2592000"))  # 30 days
strategy_memory_store = StrategyMemoryStore(
    redis_url=settings.redis_url,
    ttl_seconds=_strategy_mem_ttl,
)

# A-05: Internal service secret (shared between Gateway → Brain)
_INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "")
_IS_DEV = os.getenv("ENVIRONMENT", "development") == "development"

def _check_internal_secret(x_internal_secret: str | None = Header(default=None, alias="X-Internal-Secret")):
    """A-05: Validate shared service-to-service secret.
    
    Skipped in development mode (no INTERNAL_SECRET set).
    In production: Gateway must inject X-Internal-Secret header on every request.
    """
    if _IS_DEV or not _INTERNAL_SECRET:
        return  # Dev mode — allow all
    if not x_internal_secret or x_internal_secret != _INTERNAL_SECRET:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail="Forbidden: missing or invalid X-Internal-Secret header",
        )

# FastAPI dependency for protected routes
RequireInternalAuth = Depends(_check_internal_secret)



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
    # F-01: 初始化策略記憶儲存
    await strategy_memory_store.connect()
    logger.info(f"  Strategy memory backend: {strategy_memory_store.backend}")
    yield
    # Cleanup
    await session_store.close()
    await strategy_memory_store.close()
    await ai_gateway.close()
    await fusion_client.close()
    await trade_planner.close()
    await market_data.close()
    logger.info("Investment Brain shut down")


# ── FastAPI App ────────────────────────────────────────────
app = FastAPI(
    title="XXT-AGENT Investment Brain",
    description="""
## 多代理人投資智能系統

基於 **LangGraph** 的多代理人投資分析引擎，整合技術分析、資訊核實與風險管理。

### 架構
```
市場分析師 → 資訊核實 → 策略規劃 → 風險管理 → (執行/評估)
```

### 安全性
- 所有 `/invest/*` 端點需要 `X-Internal-Secret` header（A-05）
- 直接呼叫請透過 **OpenClaw Gateway**（port 3100）

### 免責聲明
> ⚠️ 本系統所有輸出僅供**投資參考**，不構成任何投資建議。
> 投資有風險，入市須謹慎。
""",
    version=_APP_VERSION,
    contact={
        "name": "XXT-AGENT Team",
        "url": "https://github.com/xiangteng007/XXT-AGENT",
    },
    license_info={
        "name": "Proprietary",
        "url": "https://xxt-agent.com/terms",
    },
    openapi_tags=[
        {
            "name": "health",
            "description": "Service health and readiness checks",
        },
        {
            "name": "investment",
            "description": "Investment analysis pipeline (LangGraph multi-agent)",
        },
        {
            "name": "portfolio",
            "description": "Virtual portfolio state management",
        },
        {
            "name": "sessions",
            "description": "Analysis session lifecycle and history",
        },
        {
            "name": "market",
            "description": "Market data and news feeds",
        },
    ],
    lifespan=lifespan,
    # Q-05: Docs accessible only on non-production
    docs_url="/docs" if os.getenv("ENVIRONMENT", "development") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT", "development") != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3100",
        "https://xxt-agent-dashboard.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],   # Q-04: restrict to needed methods only
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


# ── Pydantic Sub-Models (C-04: structured typing replaces bare dict) ──

class SourceReliability(BaseModel):
    news_quality:         str = "none"   # high|medium|low|none
    social_quality:       str = "none"
    cross_reference_count: int = 0

class VerificationInsightModel(BaseModel):
    is_credible:          bool = True
    credibility_score:    int  = 50
    sentiment_divergence: bool = False
    divergence_score:     int  = 0
    divergence_detail:    str  = ""
    verified_catalysts:   list[str] = []
    fake_or_hype_warnings: list[str] = []
    source_reliability:   SourceReliability = Field(default_factory=SourceReliability)
    summary:              str  = ""
    judgment_basis:       str  = ""

class MarketInsightModel(BaseModel):
    symbol:               str
    trend:                str  = "neutral"
    rsi:                  float | None = None
    macd_signal:          str  | None = None
    support_levels:       list[float] = []
    resistance_levels:    list[float] = []
    volume_analysis:      str  = ""
    key_findings:         list[str] = []
    confidence_score:     int  = 50
    analysis_timestamp:   str  = ""

class RiskBand(BaseModel):
    level:                str   # low|medium|high|critical
    score:                int
    violations:           list[str] = []
    warnings:             list[str] = []
    approved:             bool = False
    position_size_pct:    float = 0.0
    stop_loss_pct:        float | None = None
    max_loss_amount:      float | None = None

class InvestmentPlanModel(BaseModel):
    action:               str   # BUY|SELL|HOLD
    rationale:            str
    target_price:         float | None = None
    stop_loss:            float | None = None
    position_size_pct:    float = 0.0
    time_horizon:         str   = ""
    confidence:           str   = "low"
    advisory_disclaimer:  str   = "本分析僅供參考，不構成投資建議。"
    backtest_evidence:    dict  | None = None


class AnalyzeResponse(BaseModel):
    session_id:       str
    symbol:           str
    status:           str
    market_insight:   MarketInsightModel   | None = None
    investment_plan:  InvestmentPlanModel  | None = None
    risk_assessment:  RiskBand             | None = None
    verification:     VerificationInsightModel | None = None
    trade_results:    list[dict] = []
    portfolio:        dict  | None = None
    strategy_memory:  dict  | None = None
    messages:         list[str]  = []
    started_at:       str
    completed_at:     str  | None = None
    error:            str  | None = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    graph_nodes: list[str]
    risk_limits: dict
    active_sessions: int
    timestamp: str


# ── Endpoints ──────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Service health check. Returns version, active sessions, and risk limit configuration."""
    return HealthResponse(
        status="ok",
        service="investment-brain",
        version=_APP_VERSION,   # Q-02: dynamic from pyproject.toml
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


@app.post(
    "/invest/analyze",
    response_model=AnalyzeResponse,
    dependencies=[RequireInternalAuth],
    tags=["investment"],
    summary="執行全套投資分析流程",
    response_description="分析結果，含市場洞察、策略規劃、風险評估、訚啟儲諸",
)
async def analyze_investment(req: AnalyzeRequest):
    """
    執行完整投資分析流程。

    **A-05**: 生產環境需要 `X-Internal-Secret` header，請透過 OpenClaw Gateway 呼叫。

    **流程**: 市場分析師 → 資訊核實 → 策略規劃 → 風险管理 → (執行) → (評估)

    **免責聲明**: 本分析不構成任何投資建議。
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


# ── F-06: SSE Streaming Endpoint ───────────────────────────

import asyncio
from fastapi.responses import StreamingResponse


def _sse_event(event: str, data: Any) -> str:
    """Format a Server-Sent Event message."""
    payload = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


@app.post(
    "/invest/analyze/stream",
    tags=["investment"],
    summary="投資分析（SSE 即時串流）",
    dependencies=[RequireInternalAuth],
    response_class=StreamingResponse,
)
async def analyze_investment_stream(req: AnalyzeRequest):
    """
    F-06: SSE 串流版投資分析。

    與 `POST /invest/analyze` 功能相同，但改以 Server-Sent Events 推送即時進度。

    **事件類型：**
    | event           | 說明                        |
    |-----------------|---------------------------|
    | `started`       | 分析啟動，回傳 session_id     |
    | `node_start`    | LangGraph 節點開始執行        |
    | `node_complete` | LangGraph 節點完成           |
    | `graph_complete`| 全圖完成，回傳最終 AnalyzeResponse |
    | `error`         | 執行失敗                     |

    **前端使用範例（TypeScript）：**
    ```ts
    const source = new EventSource('/invest/analyze/stream');
    source.addEventListener('graph_complete', (e) => {
      const result = JSON.parse(e.data);
      console.log(result);
    });
    ```
    """
    session_id = str(uuid.uuid4())
    symbol = req.symbol.upper().strip()

    if not symbol:
        raise HTTPException(status_code=400, detail="symbol is required")

    async def event_generator():
        # 1. Send started event
        yield _sse_event("started", {
            "session_id": session_id,
            "symbol": symbol,
            "timeframe": req.timeframe,
            "risk_level": req.risk_level,
        })

        # 2. Build initial state
        initial_state = create_initial_state(
            symbol=symbol,
            timeframe=req.timeframe,
            risk_level=req.risk_level,
            user_context=req.user_context,
            session_id=session_id,
        )

        # 3. Run graph with per-step streaming via astream_events
        NODE_DISPLAY_NAMES: dict[str, str] = {
            "market_analyst":       "📊 市場分析師",
            "information_verifier": "🔍 資訊核實",
            "strategy_planner":     "📋 策略規劃",
            "risk_manager":         "⚖️ 風險管理",
            "execute_node":         "⚡ 交易執行",
            "evaluator":            "🧠 績效評估",
        }

        try:
            result: dict | None = None
            # Use astream_events (LangGraph 0.2+) for node-level progress
            async for event in investment_graph.astream_events(
                initial_state,
                version="v2",
            ):
                kind = event.get("event", "")
                name = event.get("name", "")

                if kind == "on_chain_start" and name in NODE_DISPLAY_NAMES:
                    yield _sse_event("node_start", {
                        "node": name,
                        "display": NODE_DISPLAY_NAMES[name],
                    })
                    await asyncio.sleep(0)  # yield to event loop

                elif kind == "on_chain_end" and name in NODE_DISPLAY_NAMES:
                    yield _sse_event("node_complete", {
                        "node": name,
                        "display": NODE_DISPLAY_NAMES[name],
                    })
                    await asyncio.sleep(0)

                # Capture final graph output
                if kind == "on_chain_end" and name == "LangGraph":
                    result = event.get("data", {}).get("output")

            # 4. Store session
            if result:
                session_data = {
                    "session_id": session_id,
                    "symbol": symbol,
                    "result": result,
                    "completed_at": datetime.utcnow().isoformat(),
                }
                await session_store.set(session_id, session_data)

                message_strs = [
                    msg.content for msg in result.get("messages", [])
                    if hasattr(msg, "content")
                ]
                final_response = AnalyzeResponse(
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
                yield _sse_event("graph_complete", final_response.model_dump())
            else:
                yield _sse_event("error", {"detail": "Graph returned no result"})

        except Exception as exc:
            logger.error(f"[SSE] Graph error: {exc}", exc_info=True)
            yield _sse_event("error", {"detail": str(exc)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",    # Disable Nginx buffering
            "Connection": "keep-alive",
        },
    )


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


@app.get("/invest/quote")
async def get_quote(symbol: str):
    """Get real-time quote for a symbol."""
    symbol = symbol.upper().strip()
    try:
        data = await fugle_client.get_realtime_quote(symbol)
        return data
    except Exception as e:
        logger.error(f"[API] Get quote failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/invest/candles")
async def get_candles(symbol: str, start: str, end: str):
    """Get historical candles for a symbol."""
    symbol = symbol.upper().strip()
    try:
        data = await fugle_client.get_historical_candles(symbol, start, end)
        return {"data": data}
    except Exception as e:
        logger.error(f"[API] Get candles failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/invest/news")
async def get_news(symbol: str = ""):
    """Get recent news for a symbol.

    NOTE: Returns simulated data until real news API is configured.
    Check `is_mock: true` in the response to detect simulated data.
    """
    symbol = symbol.upper().strip()
    # C-03: Simulated news — marked explicitly so the frontend can show a banner
    import random
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    base_titles = (
        [
            f"{symbol} 宣布擴大 AI 晶片產能，預期下半年營收成長 20%",
            f"外資看好 {symbol} 供應鏈地位，調高目標價",
            f"{symbol} 遭遇供應鏈挑戰，法人擔憂短期毛利率受壓",
            f"{symbol} 財報亮眼，EPS 創歷史新高",
            f"市場傳聞 {symbol} 拿下北美大單，預計 Q3 放量",
        ]
        if symbol
        else [
            "台股大盤指數創新高，半導體類股領漲",
            "外資期貨淨多單增加，顯示市場信心回穩",
            "央行維持利率不變，符合市場預期",
            "國際熱錢湧入，新台幣匯率強勢升值",
            "AI 概念股輪動，資金流向低基期個股",
        ]
    )

    # Deduplicate by shuffling without replacement
    shuffled = list(base_titles)
    random.shuffle(shuffled)

    news_items = []
    for i, title in enumerate(shuffled[:5]):
        hours_ago = random.randint(1, 48)
        mins_ago = random.randint(0, 59)
        ts = (now - timedelta(hours=hours_ago, minutes=mins_ago)).isoformat() + "Z"
        news_items.append({
            "id": f"news_{uuid.uuid4().hex[:8]}",
            "title": title,
            "summary": f"這是關於 {symbol or '市場'} 的重要新聞摘要。分析師表示這將對未來走勢產生顯著影響...",
            "timestamp": ts,
            "source": random.choice(["財經新聞", "經濟日報", "鉅亨網", "Bloomberg"]),
            "sentiment": random.choice(["positive", "neutral", "negative"]),
        })

    news_items.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "data": news_items,
        "is_mock": True,              # C-03: explicit mock flag
        "mock_reason": "Real news API not yet configured. Data is simulated for UI demonstration.",
    }


@app.get("/invest/backtest")
async def run_backtest(symbol: str, start: str = "2023-01-01", end: str = "2024-01-01"):
    """
    Run backtesting strategy on historical data sourced from Fugle (C-2).
    """
    symbol = symbol.upper().strip()
    try:
        # 1. Fetch data from Fugle
        historical_data = await fugle_client.get_historical_candles(symbol, start, end)
        if not historical_data:
            return {"error": f"No data found for {symbol} between {start} and {end}."}
        
        # 2. Run Backtest
        metrics = backtest_engine.calculate_metrics(historical_data)
        
        return {
            "symbol": symbol,
            "status": "success",
            "metrics": metrics
        }
    except Exception as e:
        logger.error(f"[API] Backtest failed for {symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")


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


# ── F-01: Strategy Memory Endpoints ───────────────────────


class RecordPatternRequest(BaseModel):
    pattern: str = Field(..., description="Pattern description")
    symbol: str | None = Field(default=None, description="Associated stock symbol")
    outcome: str = Field(
        default="success",
        description="Pattern outcome: 'success' or 'failure'",
    )
    user_id: str = Field(default="default", description="User namespace")


@app.get(
    "/invest/memory",
    tags=["sessions"],
    summary="取得策略記憶摘要",
    dependencies=[RequireInternalAuth],
)
async def get_strategy_memory(user_id: str = "default"):
    """
    F-01: 取得跨 session 策略記憶。

    回傳包含：
    - `prompt_fragment`：可注入 LLM prompt 的記憶摘要文字
    - `raw`：原始記憶資料（成功/失敗模式、市況偏好）
    - `backend`：目前使用的儲存後端（redis / memory）
    """
    memory = await strategy_memory_store.get(user_id)
    fragment = await strategy_memory_store.build_memory_prompt_fragment(user_id)
    return {
        "user_id": user_id,
        "has_memory": memory is not None,
        "backend": strategy_memory_store.backend,
        "prompt_fragment": fragment,
        "raw": memory,
    }


@app.post(
    "/invest/memory/record",
    tags=["sessions"],
    summary="記錄策略模式",
    dependencies=[RequireInternalAuth],
)
async def record_strategy_pattern(req: RecordPatternRequest):
    """
    F-01: 記錄一筆策略成功/失敗模式到跨 session 記憶。
    evaluator 節點在分析完成後自動呼叫此端點。
    """
    if req.outcome == "failure":
        await strategy_memory_store.add_failed_pattern(
            pattern=req.pattern, symbol=req.symbol, user_id=req.user_id
        )
    else:
        await strategy_memory_store.add_successful_pattern(
            pattern=req.pattern, symbol=req.symbol, user_id=req.user_id
        )
    return {"ok": True, "outcome": req.outcome, "backend": strategy_memory_store.backend}


@app.delete(
    "/invest/memory",
    tags=["sessions"],
    summary="清除策略記憶（管理用）",
    dependencies=[RequireInternalAuth],
)
async def clear_strategy_memory(user_id: str = "default"):
    """F-01: 清除指定 user_id 的所有策略記憶（管理/重置用）。"""
    await strategy_memory_store.clear(user_id)
    return {"ok": True, "cleared_user_id": user_id}


# ── Run with uvicorn ───────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
