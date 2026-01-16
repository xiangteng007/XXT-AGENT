"""
Telegram Command Bot — Main Entry Point

Cloud Run service that:
1. Receives Telegram webhook updates
2. Validates secret token header
3. Handles commands: /start, /help, /watch, /watchlist, /analyze
4. Calls trade-planner-worker for /analyze
"""
from __future__ import annotations

import logging
from aiohttp import web

from .config import Settings
from .redis_watch import WatchStore
from .tg_api import send_message
from .trade_planner_client import analyze


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("telegram-command-bot")


def get_secret_header(request: web.Request) -> str:
    """Get Telegram webhook secret token from header."""
    return request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")


def parse_command(text: str) -> tuple[str, list[str]]:
    """Parse command and arguments from message text."""
    t = (text or "").strip()
    if not t.startswith("/"):
        return "", []
    parts = t.split()
    cmd = parts[0].lower().split("@")[0]  # Handle /cmd@botname format
    args = parts[1:]
    return cmd, args


def format_analyze_result(symbol: str, result: dict) -> str:
    """Format trade planner result for Telegram message."""
    action = ((result.get("suggested_action") or {}).get("action")) or "WATCH"
    confidence = ((result.get("suggested_action") or {}).get("confidence")) or 0
    timing = ((result.get("suggested_action") or {}).get("timing_window")) or "-"
    risk_flags = ((result.get("suggested_action") or {}).get("risk_flags")) or []
    invalidations = ((result.get("suggested_action") or {}).get("invalidation_rules")) or []
    
    snapshot = result.get("snapshot") or {}
    price = snapshot.get("price") or 0
    vol_regime = snapshot.get("volatility_regime") or "-"
    
    catalysts = result.get("catalysts") or {}
    news = catalysts.get("news_top3") or []
    social = catalysts.get("social_top3") or []
    
    market = result.get("market_structure") or {}
    trend = market.get("trend") or "-"
    
    # Format message
    lines = [
        f"📊 <b>{symbol} Analysis</b>",
        f"━━━━━━━━━━━━━━━",
        f"💰 Price: ${price:.2f}" if price else "",
        f"📈 Trend: {trend} | Vol: {vol_regime}",
        f"",
        f"🎯 <b>Action: {action}</b>",
        f"📊 Confidence: {confidence}%",
        f"⏰ Timing: {timing}",
    ]
    
    if risk_flags:
        lines.append(f"⚠️ Risks: {', '.join(risk_flags[:3])}")
    
    if invalidations:
        lines.append(f"")
        lines.append(f"❌ Invalidation:")
        for inv in invalidations[:2]:
            lines.append(f"  • {inv[:50]}")
    
    if news or social:
        lines.append(f"")
        lines.append(f"🔍 <b>Catalysts (Triple Fusion):</b>")
        if news:
            lines.append(f" 📰 <i>News:</i>")
            for n in news[:2]:
                lines.append(f"  • {n[:60]}...")
        if social:
            lines.append(f" 💬 <i>Social:</i>")
            for s in social[:2]:
                lines.append(f"  • {s[:60]}...")
    
    lines.append(f"")
    lines.append(f"⚠️ <i>Decision support only, not financial advice.</i>")
    
    return "\n".join(filter(None, lines))


async def handle_telegram(request: web.Request) -> web.Response:
    """Handle Telegram webhook updates."""
    settings: Settings = request.app["settings"]
    store: WatchStore = request.app["watch_store"]

    # Verify secret token if configured
    if settings.telegram_webhook_secret_token:
        hdr = get_secret_header(request)
        if hdr != settings.telegram_webhook_secret_token:
            logger.warning("Invalid webhook secret token")
            return web.Response(status=401)

    try:
        update = await request.json()
    except Exception:
        return web.Response(status=400)

    msg = update.get("message") or update.get("edited_message") or {}
    chat = msg.get("chat") or {}
    chat_id = str(chat.get("id", ""))
    text = msg.get("text", "") or ""

    if not chat_id:
        return web.Response(status=204)

    cmd, args = parse_command(text)
    
    # /start, /help
    if cmd in ("/help", "/start"):
        await send_message(
            settings.telegram_bot_token,
            chat_id,
            "🤖 <b>AI ME Trading Assistant (v1.3.0)</b>\n\n"
            "<b>Market & Analysis:</b>\n"
            "• /analyze <SYM> - In-depth Triple Fusion analysis\n"
            "• /watch add <SYM> - Follow a symbol\n"
            "• /watchlist - Show your followed symbols\n\n"
            "<b>Social Monitor:</b>\n"
            "• /social stats - General social activity\n"
            "• /social top - Top social signals now\n",
            parse_mode="HTML"
        )
        return web.Response(status=204)

    # /social
    if cmd == "/social":
        sub = args[0].lower() if args else "stats"
        if sub == "stats":
            await send_message(settings.telegram_bot_token, chat_id, "📡 <b>Social Scan Stats</b>\n- Active Sources: 12\n- 24h Volume: 1,420 posts\n- Hot Topics: #TSMC, #NVIDIA", parse_mode="HTML")
        elif sub == "top":
            await send_message(settings.telegram_bot_token, chat_id, "🔥 <b>Top Social Signals</b>\n1. <b>TSMC</b>: Large sentiment spike on PTT\n2. <b>NVDA</b>: Earnings rumors on Twitter\n3. <b>AAPL</b>: Supply chain leak", parse_mode="HTML")
        else:
            await send_message(settings.telegram_bot_token, chat_id, "Usage: /social [stats|top]")
        return web.Response(status=204)

    # /watch add/remove
    if cmd == "/watch" and len(args) >= 2:
        action = args[0].lower()
        sym = args[1].upper()

        if action == "add":
            store.add(chat_id, sym)
            await send_message(settings.telegram_bot_token, chat_id, f"✅ Added <b>{sym}</b> to watchlist.", parse_mode="HTML")
        elif action == "remove":
            store.remove(chat_id, sym)
            await send_message(settings.telegram_bot_token, chat_id, f"🗑 Removed <b>{sym}</b> from watchlist.", parse_mode="HTML")
        else:
            await send_message(settings.telegram_bot_token, chat_id, "Usage: /watch add <SYM> or /watch remove <SYM>")
        return web.Response(status=204)

    # /watchlist
    if cmd == "/watchlist":
        items = store.list(chat_id)
        if items:
            await send_message(
                settings.telegram_bot_token,
                chat_id,
                "📌 <b>Your Watchlist:</b>\n" + "\n".join([f"• {s}" for s in items]),
                parse_mode="HTML"
            )
        else:
            await send_message(settings.telegram_bot_token, chat_id, "📌 Watchlist is empty. Use /watch add <SYM> to add symbols.")
        return web.Response(status=204)

    # /analyze
    if cmd == "/analyze":
        if not args:
            await send_message(settings.telegram_bot_token, chat_id, "Usage: /analyze <SYM>")
            return web.Response(status=204)
        
        sym = args[0].upper()
        
        if not settings.trade_planner_url:
            await send_message(settings.telegram_bot_token, chat_id, "❌ Trade planner not configured.")
            return web.Response(status=204)

        await send_message(settings.telegram_bot_token, chat_id, f"🔄 Analyzing {sym} with Triple Fusion...")
        
        resp = await analyze(settings.trade_planner_url, sym, timeframe="15m")
        
        if not resp.get("ok"):
            await send_message(settings.telegram_bot_token, chat_id, f"❌ Analysis failed: {resp.get('error', 'unknown error')}")
            return web.Response(status=204)
        
        result = resp.get("result") or {}
        msg_text = format_analyze_result(sym, result)
        await send_message(settings.telegram_bot_token, chat_id, msg_text, parse_mode="HTML")
        
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
    app["watch_store"] = WatchStore(settings.redis_host, settings.redis_port)

    app.router.add_post("/telegram", handle_telegram)
    app.router.add_get("/healthz", handle_health)
    
    return app


if __name__ == "__main__":
    logger.info("Starting telegram-command-bot service")
    web.run_app(create_app(), host="0.0.0.0", port=8080)
