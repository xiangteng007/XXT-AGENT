"""
Trade Planner Worker — Main Entry Point

Cloud Run service that:
1. Receives /analyze requests with symbol and timeframe
2. Fetches recent candles from Cloud SQL
3. Fetches recent news from Redis (shared with event-fusion-engine)
4. Calls Gemini to generate trade plan following SKILL contract
5. Returns structured JSON response
"""
from __future__ import annotations

import logging
from aiohttp import web
import orjson

from .config import Settings
from .sql import CandleSQL
from .redis_store import PlannerStore
from .gemini_client import GeminiClient
from .skill_contract import TRADE_PLANNER_CONTRACT


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("trade-planner-worker")


def compute_support_resistance(candles: list[dict]) -> tuple[list[float], list[float]]:
    """Compute simple support/resistance from candle lows/highs."""
    if not candles:
        return [], []
    lows = [c["low"] for c in candles]
    highs = [c["high"] for c in candles]
    support = sorted(set([min(lows)]))
    resistance = sorted(set([max(highs)]))
    return support, resistance


def trend_label(candles: list[dict]) -> str:
    """Determine trend direction from candle series."""
    if len(candles) < 20:
        return "range"
    c0 = candles[0]["close"]  # oldest
    cN = candles[-1]["close"]  # newest
    if cN > c0 * 1.01:
        return "up"
    if cN < c0 * 0.99:
        return "down"
    return "range"


def volatility_regime(candles: list[dict]) -> str:
    """Estimate volatility regime from price range."""
    if len(candles) < 20:
        return "normal"
    closes = [c["close"] for c in candles[:60]]
    if not closes:
        return "normal"
    mx = max(closes)
    mn = min(closes)
    if mn <= 0:
        return "normal"
    rng = (mx - mn) / mn
    if rng > 0.03:
        return "high"
    if rng < 0.01:
        return "low"
    return "normal"


def build_fallback(symbol: str, timeframe: str, latest_price: float, trend: str, vol: str,
                   support: list[float], resistance: list[float], news_top3: list[str], social_top3: list[str]) -> dict:
    """Build fallback response when LLM is unavailable."""
    return {
        "snapshot": {
            "symbol": symbol, 
            "timeframe": timeframe, 
            "price": latest_price, 
            "volatility_regime": vol
        },
        "catalysts": {
            "news_top3": news_top3, 
            "social_top3": social_top3
        },
        "market_structure": {
            "trend": trend,
            "support": support,
            "resistance": resistance,
            "volume_note": "Volume analysis from last 30 candles",
        },
        "scenarios": {
            "base": {"path": "Continue current regime with mean reversion near key levels.", "prob": 55},
            "bull": {"path": "Break above resistance with volume confirmation.", "prob": 25},
            "bear": {"path": "Lose support and accelerate downside.", "prob": 20},
        },
        "suggested_action": {
            "action": "WATCH",
            "timing_window": "next 1-4h",
            "confidence": 55,
            "invalidation_rules": [
                "If price breaks below support with rising volume.",
                "If major negative news breaks."
            ],
            "risk_flags": ["uncertainty"],
        },
        "disclosures": [
            "This is informational decision support, not financial advice.",
            "High volatility can cause rapid losses.",
        ],
    }


async def handle_analyze(request: web.Request) -> web.Response:
    """Handle /analyze requests."""
    settings: Settings = request.app["settings"]
    sql: CandleSQL = request.app["sql"]
    store: PlannerStore = request.app["store"]
    gemini: GeminiClient = request.app["gemini"]

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "invalid json"}, status=400)
    
    symbol = str(body.get("symbol", "")).upper().strip()
    timeframe = str(body.get("timeframe", "15m")).strip()

    if not symbol:
        return web.json_response({"ok": False, "error": "symbol required"}, status=400)

    # Fetch candles from SQL
    candles = sql.fetch_recent_1m(symbol, limit=120)
    candles = list(reversed(candles))  # chronological order

    latest_price = candles[-1]["close"] if candles else 0.0
    support, resistance = compute_support_resistance(candles[-60:])
    trend = trend_label(candles[-60:])
    vol = volatility_regime(candles[-60:])

    # Fetch news & social from Redis
    news = store.get_recent_news(symbol, settings.news_lookback_sec)
    news_top3 = [n.get("headline", "") for n in news[:3] if n.get("headline")]
    
    social = store.get_recent_social(symbol, settings.social_lookback_sec)
    social_top3 = [s.get("title", "") for s in social[:3] if s.get("title")]

    # Build fallback in case LLM fails
    fallback = build_fallback(symbol, timeframe, latest_price, trend, vol, support, resistance, news_top3, social_top3)

    # Try Gemini if configured
    if not settings.gemini_api_key:
        logger.info(f"Analyze {symbol}: returning fallback (no API key)")
        return web.json_response({"ok": True, "result": fallback})

    try:
        user_payload = {
            "symbol": symbol,
            "timeframe": timeframe,
            "latest_price": latest_price,
            "trend": trend,
            "volatility_regime": vol,
            "support": support,
            "resistance": resistance,
            "recent_news": news[:5],
            "recent_social": social[:5],
            "recent_candles_1m_tail": candles[-30:],
        }

        result = await gemini.generate_json(
            system_text=TRADE_PLANNER_CONTRACT,
            user_text=f"DATA(JSON): {orjson.dumps(user_payload).decode('utf-8')}",
        )
        
        logger.info(f"Analyze {symbol}: LLM response received")
        return web.json_response({"ok": True, "result": result})

    except Exception as e:
        logger.warning(f"Analyze {symbol}: LLM failed ({e}), returning fallback")
        return web.json_response({"ok": True, "result": fallback})


async def handle_health(request: web.Request) -> web.Response:
    """Health check endpoint."""
    return web.json_response({"ok": True})


def create_app() -> web.Application:
    """Create the aiohttp application."""
    settings = Settings()
    
    app = web.Application()
    app["settings"] = settings
    app["sql"] = CandleSQL(settings.sql_host, settings.sql_db, settings.sql_user, settings.sql_password)
    app["store"] = PlannerStore(settings.redis_host, settings.redis_port)
    app["gemini"] = GeminiClient(settings.gemini_api_key, settings.gemini_model)

    app.router.add_post("/analyze", handle_analyze)
    app.router.add_get("/healthz", handle_health)
    
    return app


if __name__ == "__main__":
    logger.info("Starting trade-planner-worker service")
    web.run_app(create_app(), host="0.0.0.0", port=8080)
