"""
Quote Normalizer — Main Entry Point

Cloud Run service that:
1. Receives trade events from Pub/Sub (quotes.raw)
2. Aggregates into 1-minute OHLCV candles in Redis
3. On /flush (triggered by Scheduler), finalizes candles to SQL and publishes to events.normalized
"""
from __future__ import annotations

import base64
import json
import logging
import time
from datetime import datetime, timezone

from aiohttp import web

from .config import Settings
from .models import QuoteTradeEvent, Candle1mEvent
from .pubsub import PubSubPublisher
from .redis_candles import CandleRedisStore
from .sql import CandleSQL


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("quote-normalizer")


def pubsub_decode(request_json: dict) -> dict:
    """Decode base64 Pub/Sub message data."""
    msg = request_json.get("message", {})
    data_b64 = msg.get("data", "")
    if not data_b64:
        return {}
    raw = base64.b64decode(data_b64).decode("utf-8")
    return json.loads(raw)


def minute_bucket_ms(ts_ms: int) -> int:
    """Round timestamp down to minute boundary."""
    return (ts_ms // 60000) * 60000


async def handle_pubsub(request: web.Request) -> web.Response:
    """Handle incoming Pub/Sub push messages (trade events)."""
    settings: Settings = request.app["settings"]
    store: CandleRedisStore = request.app["redis_store"]

    try:
        payload = await request.json()
    except Exception:
        return web.Response(status=400)
    
    decoded = pubsub_decode(payload)
    if not decoded:
        return web.Response(status=204)

    # Ignore heartbeats and non-trade events
    if decoded.get("event_type") != "trade":
        return web.Response(status=204)

    try:
        ev = QuoteTradeEvent.model_validate(decoded)
    except Exception as e:
        logger.warning(f"Invalid trade event: {e}")
        return web.Response(status=204)
    
    sym = ev.instrument.symbol
    m_ts = minute_bucket_ms(ev.ts_ms)

    store.upsert_trade(
        symbol=sym,
        minute_ts_ms=m_ts,
        price=ev.price,
        volume=ev.volume,
        ts_ms=ev.ts_ms,
        ttl_sec=settings.candle_ttl_sec,
    )
    
    return web.Response(status=204)


async def handle_flush(request: web.Request) -> web.Response:
    """Finalize completed candles: write to SQL and publish to Pub/Sub."""
    settings: Settings = request.app["settings"]
    store: CandleRedisStore = request.app["redis_store"]
    pub: PubSubPublisher = request.app["pub"]
    sql: CandleSQL = request.app["sql"]

    now_ms = int(time.time() * 1000)
    current_minute = minute_bucket_ms(now_ms)
    finalize_before_ms = current_minute - settings.finalize_before_sec * 1000

    flushed = 0
    errors = 0
    
    for key in store.scan_candle_keys():
        data = store.get_candle_hash(key)
        if not data:
            continue

        # Parse minute_ts from key: candle:1m:SYMBOL:MINUTE
        try:
            parts = key.split(":")
            minute_ts_ms = int(parts[-1])
            symbol = parts[-2]
        except Exception:
            continue

        # Skip current minute (still aggregating)
        if minute_ts_ms >= current_minute:
            continue

        # Only flush if candle is stale enough
        last_update_ms = int(float(data.get("last_update_ms", "0")))
        if last_update_ms > finalize_before_ms:
            continue

        try:
            o = float(data["open"])
            h = float(data["high"])
            l = float(data["low"])
            c = float(data["close"])
            v = float(data["volume"])
        except (KeyError, ValueError) as e:
            logger.warning(f"Invalid candle data for {key}: {e}")
            store.delete_key(key)
            errors += 1
            continue

        finalized_at = datetime.now(timezone.utc)

        # Create candle event
        candle_ev = Candle1mEvent(
            symbol=symbol,
            minute_ts_ms=minute_ts_ms,
            open=o,
            high=h,
            low=l,
            close=c,
            volume=v,
            finalized_at=finalized_at,
        )

        # Write to SQL
        try:
            sql.upsert_candle(
                symbol=symbol,
                minute_ts_ms=minute_ts_ms,
                o=o, h=h, l=l, c=c, v=v,
                finalized_at_iso=finalized_at.isoformat(),
            )
        except Exception as e:
            logger.error(f"SQL upsert failed for {symbol}: {e}")
            errors += 1
            continue

        # Publish to events.normalized
        try:
            pub.publish_json(settings.topic_events_normalized, candle_ev.model_dump(mode="json"))
        except Exception as e:
            logger.error(f"Pub/Sub publish failed: {e}")

        # Clean up Redis
        store.delete_key(key)
        flushed += 1

    logger.info(f"Flush complete: {flushed} candles finalized, {errors} errors")
    return web.json_response({"ok": True, "flushed": flushed, "errors": errors})


async def handle_health(request: web.Request) -> web.Response:
    """Health check endpoint."""
    return web.json_response({"ok": True})


def create_app() -> web.Application:
    """Create the aiohttp application."""
    settings = Settings()

    app = web.Application()
    app["settings"] = settings
    app["redis_store"] = CandleRedisStore(settings.redis_host, settings.redis_port)
    app["pub"] = PubSubPublisher(settings.gcp_project_id)
    app["sql"] = CandleSQL(settings.sql_host, settings.sql_db, settings.sql_user, settings.sql_password)

    # Initialize schema (best-effort)
    if settings.sql_host:
        try:
            app["sql"].ensure_schema()
            logger.info("SQL schema initialized")
        except Exception as e:
            logger.warning(f"Schema init failed (will retry on first write): {e}")

    app.router.add_post("/pubsub", handle_pubsub)
    app.router.add_post("/flush", handle_flush)
    app.router.add_get("/healthz", handle_health)

    return app


if __name__ == "__main__":
    logger.info("Starting quote-normalizer service")
    web.run_app(create_app(), host="0.0.0.0", port=8080)
