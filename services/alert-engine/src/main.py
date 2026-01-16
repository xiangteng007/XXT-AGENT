"""
Alert Engine — Main Entry Point

Cloud Run service that:
1. Receives normalized events from Pub/Sub (events.normalized)
2. Handles candle_1m events: price change threshold alerting
3. Handles fused_event events: severity + news headline alerting
4. Applies type-aware cooldown throttling via Redis
5. Pushes alerts to Telegram and LINE
"""
from __future__ import annotations

import base64
import json
import logging
from aiohttp import web

from .config import Settings
from .models import Candle1mEvent, FusedEvent
from .redis_state import AlertState
from .notifiers import send_telegram, send_line


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("alert-engine")


def pubsub_decode(request_json: dict) -> dict:
    """Decode base64 Pub/Sub message data."""
    msg = request_json.get("message", {})
    data_b64 = msg.get("data", "")
    if not data_b64:
        return {}
    raw = base64.b64decode(data_b64).decode("utf-8")
    return json.loads(raw)


def candle_change_pct(c: Candle1mEvent) -> float:
    """Calculate percentage change from open to close."""
    if c.open <= 0:
        return 0.0
    return ((c.close - c.open) / c.open) * 100.0


def format_candle_message(candle: Candle1mEvent, pct: float) -> str:
    """Format candle_1m alert message for push notification."""
    direction = "📈 上漲" if pct > 0 else "📉 下跌"
    emoji = "🔥" if abs(pct) > 2 else "⚠️"
    
    return (
        f"{emoji} <b>[即時警報] {candle.symbol}</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"📊 1分鐘 K 線異動\n"
        f"• 方向：{direction} <b>{pct:+.2f}%</b>\n"
        f"• O/H/L/C：{candle.open:.2f}/{candle.high:.2f}/{candle.low:.2f}/{candle.close:.2f}\n"
        f"• 成交量：{candle.volume:,.0f}\n"
        f"• 時間：{candle.minute_ts_ms}\n"
        f"━━━━━━━━━━━━━━━\n"
        f"⏰ {candle.finalized_at.strftime('%H:%M:%S')}"
    )


def format_fused_message(ev: FusedEvent) -> str:
    """Format fused_event alert message with news headlines."""
    # Direction in Chinese
    if ev.direction == "positive":
        direction_zh = "📈 利多"
        emoji = "🟢"
    elif ev.direction == "negative":
        direction_zh = "📉 利空"
        emoji = "🔴"
    else:
        direction_zh = "➡️ 中性"
        emoji = "🟡"
    
    # Severity indicator
    if ev.severity >= 70:
        severity_emoji = "🔥🔥🔥"
    elif ev.severity >= 50:
        severity_emoji = "🔥🔥"
    elif ev.severity >= 35:
        severity_emoji = "🔥"
    else:
        severity_emoji = ""
    
    # Build news block
    news_lines = []
    for n in (ev.top_news or [])[:3]:
        headline = (n.headline or "").strip()
        source = (n.source or "").strip()
        url = (n.url or "").strip()
        
        if not headline and not url:
            continue
        
        if url:
            news_lines.append(f"  • {headline[:50]} ({source})\n    🔗 {url}")
        else:
            news_lines.append(f"  • {headline[:60]} ({source})")
    
    news_block = "\n".join(news_lines) if news_lines else "  • (無可用新聞摘要)"
    
    return (
        f"{emoji} <b>[融合事件] {ev.symbol}</b> {severity_emoji}\n"
        f"━━━━━━━━━━━━━━━\n"
        f"📊 Direction：{direction_zh}\n"
        f"🎯 Severity：<b>{ev.severity}/100</b>\n"
        f"📈 1m Move：{ev.price_change_pct_1m:+.2f}%\n"
        f"📰 News Count：{ev.news_count_lookback}\n"
        f"━━━━━━━━━━━━━━━\n"
        f"<b>Top Headlines:</b>\n{news_block}\n"
        f"━━━━━━━━━━━━━━━\n"
        f"⏰ {ev.fused_at[:19] if ev.fused_at else '-'}"
    )


async def handle_pubsub(request: web.Request) -> web.Response:
    """Handle incoming Pub/Sub push messages (normalized events)."""
    settings: Settings = request.app["settings"]
    state: AlertState = request.app["state"]

    try:
        payload = await request.json()
    except Exception:
        return web.Response(status=400)
    
    decoded = pubsub_decode(payload)
    if not decoded:
        return web.Response(status=204)

    event_type = decoded.get("event_type", "")

    # ===========================
    # A) candle_1m alerts
    # ===========================
    if event_type == "candle_1m":
        try:
            candle = Candle1mEvent.model_validate(decoded)
        except Exception as e:
            logger.warning(f"Invalid candle event: {e}")
            return web.Response(status=204)
        
        pct = candle_change_pct(candle)
        
        # Check threshold
        if abs(pct) < settings.min_change_pct_to_alert:
            return web.Response(status=204)

        # Check cooldown (type-aware)
        if not state.can_alert("candle_1m", candle.symbol):
            logger.debug(f"Candle alert for {candle.symbol} throttled by cooldown")
            return web.Response(status=204)

        # Format and send alerts
        text = format_candle_message(candle, pct)
        
        telegram_sent = await send_telegram(
            settings.telegram_bot_token, 
            settings.telegram_chat_id, 
            text
        )
        
        line_sent = await send_line(
            settings.line_channel_access_token, 
            settings.line_to, 
            text.replace("<b>", "").replace("</b>", "")
        )
        
        if telegram_sent or line_sent:
            state.set_cooldown("candle_1m", candle.symbol, settings.default_alert_cooldown_sec)
            logger.info(f"Candle alert sent for {candle.symbol}: {pct:+.2f}%")
        
        return web.Response(status=204)

    # ===========================
    # B) fused_event alerts (NEW)
    # ===========================
    if event_type == "fused_event":
        try:
            # Handle both nested and flat price data
            if "price" in decoded and isinstance(decoded["price"], dict):
                decoded["price_change_pct_1m"] = decoded["price"].get("change_pct_1m", 0)
            if "news_context" in decoded:
                decoded["news_count_lookback"] = decoded["news_context"].get("count_lookback", 0)
            if "news_items" in decoded and not decoded.get("top_news"):
                decoded["top_news"] = decoded["news_items"]
            
            ev = FusedEvent.model_validate(decoded)
        except Exception as e:
            logger.warning(f"Invalid fused event: {e}")
            return web.Response(status=204)
        
        # Check severity threshold
        if ev.severity < settings.min_fused_severity_to_alert:
            logger.debug(f"Fused event for {ev.symbol} below severity threshold ({ev.severity} < {settings.min_fused_severity_to_alert})")
            return web.Response(status=204)

        # Check cooldown (type-aware)
        if not state.can_alert("fused_event", ev.symbol):
            logger.debug(f"Fused alert for {ev.symbol} throttled by cooldown")
            return web.Response(status=204)

        # Format and send alerts
        text = format_fused_message(ev)
        
        telegram_sent = await send_telegram(
            settings.telegram_bot_token, 
            settings.telegram_chat_id, 
            text
        )
        
        line_sent = await send_line(
            settings.line_channel_access_token, 
            settings.line_to, 
            text.replace("<b>", "").replace("</b>", "")
        )
        
        if telegram_sent or line_sent:
            state.set_cooldown("fused_event", ev.symbol, settings.fused_alert_cooldown_sec)
            logger.info(f"Fused alert sent for {ev.symbol}: severity={ev.severity}, direction={ev.direction}")
        
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
    app["state"] = AlertState(settings.redis_host, settings.redis_port)

    app.router.add_post("/pubsub", handle_pubsub)
    app.router.add_get("/healthz", handle_health)
    
    return app


if __name__ == "__main__":
    logger.info("Starting alert-engine service")
    web.run_app(create_app(), host="0.0.0.0", port=8080)
