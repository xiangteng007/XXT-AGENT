"""
Event Fusion Engine — Main Entry Point

Cloud Run service that:
1. Ingests news.raw events → extracts symbols → stores in Redis
2. Ingests candle_1m events → fuses with recent news → outputs fused_event
3. Publishes fused_event to events.normalized for AI Agent consumption
"""
from __future__ import annotations

import base64
import json
import logging
import time
from datetime import datetime, timezone

from aiohttp import web

from .config import Settings
from .pubsub import PubSubPublisher
from .redis_store import FusionStore
from .util_symbol import extract_symbols_from_related, extract_symbols_from_text


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("event-fusion-engine")


def pubsub_decode(request_json: dict) -> dict:
    """Decode base64 Pub/Sub message data."""
    msg = request_json.get("message", {})
    data_b64 = msg.get("data", "")
    if not data_b64:
        return {}
    raw = base64.b64decode(data_b64).decode("utf-8")
    return json.loads(raw)


def candle_change_pct(open_: float, close: float) -> float:
    """Calculate percentage change from open to close."""
    if open_ <= 0:
        return 0.0
    return ((close - open_) / open_) * 100.0


def compute_severity(pct: float, news_count: int, social_count: int = 0) -> int:
    """
    Compute severity score (0-100) based on price move, news count, and social signals.
    Higher price move + more news/social = higher severity.
    """
    base_severity = min(100, int(abs(pct) * 15))
    news_boost = min(50, news_count * 8)
    social_boost = min(30, social_count * 5)
    return min(100, base_severity + news_boost + social_boost)


async def handle_pubsub(request: web.Request) -> web.Response:
    """Handle incoming Pub/Sub push messages."""
    settings: Settings = request.app["settings"]
    store: FusionStore = request.app["store"]
    pub: PubSubPublisher = request.app["pub"]

    try:
        payload = await request.json()
    except Exception:
        return web.Response(status=400)
    
    decoded = pubsub_decode(payload)
    if not decoded:
        return web.Response(status=204)

    event_type = decoded.get("event_type") or decoded.get("source") or ""

    # ==================
    # 1) NEWS INGEST
    # ==================
    if event_type == "news":
        headline = (decoded.get("headline") or "").strip()
        url = (decoded.get("url") or "").strip()
        src = (decoded.get("source") or "").strip()
        summary = (decoded.get("summary") or "").strip()

        # Extract symbols from related field (Finnhub) or headline
        related = (decoded.get("related") or "").strip()
        symbols = extract_symbols_from_related(related)
        if not symbols:
            symbols = extract_symbols_from_text(headline)

        # Filter to watchlist if configured
        watch = settings.watchlist()
        if watch:
            symbols = [s for s in symbols if s in watch]

        if not symbols:
            # Check for global impact symbols if headline is very broad
            # (Stub for future logic)
            pass

        if not symbols:
            return web.Response(status=204)

        news_item = {
            "headline": headline,
            "url": url,
            "source": src,
            "summary": summary[:400],
            "ts_unix": int(time.time()),
        }

        # Store news for each matched symbol
        for sym in symbols[:10]:
            store.add_news(sym, news_item)
            logger.debug(f"Stored news for {sym}: {headline[:50]}")

        return web.Response(status=204)

    # ==================
    # 2) SOCIAL INGEST
    # ==================
    if event_type == "social":
        title = (decoded.get("title") or "").strip()
        text = (decoded.get("text") or "").strip()
        platform = (decoded.get("platform") or "").strip()
        url = (decoded.get("url") or "").strip()

        # Extract symbols from title/text
        symbols = extract_symbols_from_text(f"{title} {text}")
        
        # Filter to watchlist
        watch = settings.watchlist()
        if watch:
            symbols = [s for s in symbols if s in watch]

        if not symbols:
            return web.Response(status=204)

        social_item = {
            "title": title,
            "platform": platform,
            "url": url,
            "engagement": decoded.get("engagement", {}),
            "ts_unix": int(time.time()),
        }

        for sym in symbols[:10]:
            store.add_social(sym, social_item)
            logger.debug(f"Stored social signal for {sym}: {title[:50]}")

        return web.Response(status=204)

    # ==================
    # 3) CANDLE INGEST → TRIPLE FUSE
    # ==================
    if event_type == "candle_1m":
        symbol = decoded.get("symbol", "")
        o = float(decoded.get("open", 0))
        c = float(decoded.get("close", 0))
        h = float(decoded.get("high", 0))
        l = float(decoded.get("low", 0))
        v = float(decoded.get("volume", 0))
        minute_ts_ms = int(decoded.get("minute_ts_ms", 0))

        # Store latest close for reference
        store.set_latest_close(symbol, c, minute_ts_ms)

        # Only fuse if move is meaningful (> 0.25% - slightly lowered from 0.3)
        pct = candle_change_pct(o, c)
        if abs(pct) < 0.25:
            return web.Response(status=204)

        # Get recent news & social
        recent_news = store.get_recent_news(symbol, settings.news_lookback_sec)
        recent_social = store.get_recent_social(symbol, settings.social_lookback_sec)
        
        # Compute severity score (Triple Fusion)
        severity = compute_severity(pct, len(recent_news), len(recent_social))
        
        # Build fused event with triple-source context
        fused = {
            "schema_version": "1.3.0", # Aligned with Roadmap
            "event_type": "fused_event",
            "source": "event-fusion-engine",
            "symbol": symbol,
            "minute_ts_ms": minute_ts_ms,
            
            # Price data
            "price": {
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": v,
                "change_pct_1m": round(pct, 3),
            },
            
            # Severity & direction for AI Agent
            "severity": severity,
            "direction": "positive" if pct > 0 else "negative",
            
            # Triple Fusion Context
            "fusion_context": {
                "market": {"change_pct": round(pct, 3)},
                "news": {
                    "count": len(recent_news),
                    "headlines": [n.get("headline", "") for n in recent_news[:5]]
                },
                "social": {
                    "count": len(recent_social),
                    "top_signals": [s.get("title", "") for s in recent_social[:3]]
                }
            },
            
            # Detailed evidence for AI Agent
            "evidence": {
                "news_items": recent_news[:3],
                "social_signals": recent_social[:3]
            },
            
            "fused_at": datetime.now(timezone.utc).isoformat(),
        }

        # Publish to events.normalized
        pub.publish_json(settings.topic_events_normalized, fused)
        logger.info(f"Triple Fusion for {symbol}: {pct:+.2f}%, sev={severity}, news={len(recent_news)}, social={len(recent_social)}")
        
        return web.Response(status=204)

    return web.Response(status=204)

    return web.Response(status=204)


async def handle_health(request: web.Request) -> web.Response:
    """Health check endpoint."""
    return web.json_response({"ok": True})


def create_app() -> web.Application:
    """Create the aiohttp application."""
    settings = Settings()
    
    app = web.Application()
    app["settings"] = settings
    app["store"] = FusionStore(settings.redis_host, settings.redis_port)
    app["pub"] = PubSubPublisher(settings.gcp_project_id)

    app.router.add_post("/pubsub", handle_pubsub)
    app.router.add_get("/healthz", handle_health)
    
    return app


if __name__ == "__main__":
    logger.info("Starting event-fusion-engine service")
    web.run_app(create_app(), host="0.0.0.0", port=8080)
