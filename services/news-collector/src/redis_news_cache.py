"""
Redis news cache writer for news-collector.
Pushes collected news into Redis lists consumed by the Telegram /news command.

Key schema (matches handlers/news.py):
  nc:news:latest          → LPUSH, LTRIM 100, TTL 6h   (all news)
  nc:news:{SYMBOL}        → LPUSH, LTRIM 50, TTL 6h    (symbol-specific)
"""
from __future__ import annotations

import json
import logging
from typing import Optional

logger = logging.getLogger("news-collector.redis_cache")

NEWS_LATEST_KEY = "nc:news:latest"
NEWS_SYMBOL_KEY_TPL = "nc:news:{symbol}"
LATEST_MAX = 100      # LTRIM limit for latest list
SYMBOL_MAX = 50       # LTRIM limit per symbol list
TTL_SECONDS = 21600   # 6 hours


class NewsCache:
    """Writes news articles to Redis for the Telegram /news command."""

    def __init__(self, host: str, port: int) -> None:
        self._r = None
        try:
            import redis
            r = redis.Redis(host=host, port=port, decode_responses=True)
            r.ping()
            self._r = r
            logger.info(f"[NewsCache] Connected to Redis at {host}:{port}")
        except Exception as e:
            logger.warning(f"[NewsCache] Redis unavailable ({e}), cache disabled")

    @property
    def enabled(self) -> bool:
        return self._r is not None

    def _build_payload(
        self,
        headline: str,
        url: str,
        source: str,
        summary: str = "",
        published_at: str = "",
        image: str = "",
    ) -> str:
        return json.dumps({
            "title": headline,
            "url": url,
            "source": source,
            "summary": summary[:300] if summary else "",
            "published_at": published_at,
            "image": image,
        }, ensure_ascii=False)

    def push(
        self,
        headline: str,
        url: str,
        source: str,
        summary: str = "",
        published_at: str = "",
        image: str = "",
        related_symbol: Optional[str] = None,
    ) -> None:
        """Push a news item into Redis latest + optional symbol list."""
        if not self.enabled:
            return
        r = self._r
        try:
            payload = self._build_payload(
                headline=headline,
                url=url,
                source=source,
                summary=summary,
                published_at=published_at,
                image=image,
            )

            # Push to latest list
            r.lpush(NEWS_LATEST_KEY, payload)
            r.ltrim(NEWS_LATEST_KEY, 0, LATEST_MAX - 1)
            r.expire(NEWS_LATEST_KEY, TTL_SECONDS)

            # Push to symbol-specific list if available
            if related_symbol:
                sym_key = NEWS_SYMBOL_KEY_TPL.format(symbol=related_symbol.upper())
                r.lpush(sym_key, payload)
                r.ltrim(sym_key, 0, SYMBOL_MAX - 1)
                r.expire(sym_key, TTL_SECONDS)

        except Exception as e:
            logger.warning(f"[NewsCache] Push failed: {e}")

    def ping(self) -> bool:
        """Health check."""
        if not self.enabled:
            return False
        try:
            return self._r.ping()
        except Exception:
            return False
