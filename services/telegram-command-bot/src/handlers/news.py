"""
News command handler for telegram-command-bot.
Integrates with Redis news cache (populated by news-collector).
"""
import logging
from aiohttp import web, ClientSession, ClientTimeout

from ..tg_api import send_message
from ..config import Settings

logger = logging.getLogger(__name__)

# Redis key patterns (must match news-collector's write keys)
NEWS_LATEST_KEY = "nc:news:latest"        # LRANGE → list of JSON strings
NEWS_SYMBOL_KEY = "nc:news:{symbol}"      # LRANGE → symbol-specific news


async def handle_news(args: list[str], chat_id: str, settings: Settings) -> None:
    """
    /news [latest|<SYMBOL>|search <keyword>]

    Examples:
        /news               → latest 10 news items
        /news latest        → latest 10 news items
        /news AAPL          → AAPL-specific news
        /news TSMC          → TSMC news
    """
    try:
        import redis.asyncio as aioredis
        r = await aioredis.from_url(
            f"redis://{settings.redis_host}:{settings.redis_port}",
            encoding="utf-8",
            decode_responses=True,
        )
    except Exception as e:
        await send_message(
            settings.telegram_bot_token, chat_id,
            f"❌ Redis 連線失敗，無法取得新聞: {e}"
        )
        return

    sub = args[0].upper() if args else "LATEST"

    try:
        if sub in ("LATEST", "最新"):
            items = await r.lrange(NEWS_LATEST_KEY, 0, 9)
            title = "📰 <b>最新財經新聞 (Top 10)</b>"
        else:
            # Symbol-specific
            symbol = sub
            key = NEWS_SYMBOL_KEY.format(symbol=symbol)
            items = await r.lrange(key, 0, 4)
            if not items:
                # Fallback to latest
                items = await r.lrange(NEWS_LATEST_KEY, 0, 4)
                title = f"📰 <b>最新新聞（找不到 {symbol} 相關，顯示最新）</b>"
            else:
                title = f"📰 <b>{symbol} 相關新聞 (Top 5)</b>"

        await r.aclose()

        if not items:
            await send_message(
                settings.telegram_bot_token, chat_id,
                "📰 暫無新聞資料。news-collector 尚未推送或 Redis 快取為空。\n"
                "💡 提示：等待 news-collector 下次抓取後再試。"
            )
            return

        import json
        lines = [title, ""]
        for i, raw in enumerate(items, 1):
            try:
                news = json.loads(raw) if raw.startswith("{") else {"title": raw, "source": ""}
                news_title = news.get("title", "（無標題）")[:80]
                source = news.get("source", "")
                published = news.get("published_at", "")[:10] if news.get("published_at") else ""
                url = news.get("url", "")

                if url:
                    line = f"{i}. <a href=\"{url}\">{news_title}</a>"
                else:
                    line = f"{i}. {news_title}"

                if source or published:
                    meta = " | ".join(filter(None, [source, published]))
                    line += f"\n   <i>— {meta}</i>"
                lines.append(line)
            except Exception:
                lines.append(f"{i}. {raw[:100]}")

        message = "\n".join(lines)
        if len(message) > 4000:
            message = message[:4000] + "\n…（截斷）"

        await send_message(
            settings.telegram_bot_token, chat_id,
            message, parse_mode="HTML"
        )

    except Exception as e:
        logger.error(f"handle_news error: {e}")
        await send_message(
            settings.telegram_bot_token, chat_id,
            f"❌ 新聞查詢失敗: {e}"
        )
