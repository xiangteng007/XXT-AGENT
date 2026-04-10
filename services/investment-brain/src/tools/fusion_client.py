"""
Tools — Fusion Engine Client

Retrieves Triple Fusion data (market + news + social) from the
existing Event Fusion Engine via Redis shared state.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from ..config import settings

logger = logging.getLogger("investment-brain.tools.fusion_client")


class FusionClient:
    """Client for retrieving fused market data."""

    def __init__(self, redis_url: str | None = None):
        self.redis_url = redis_url or settings.redis_url
        self._redis = None

    async def _get_redis(self):
        """Lazy-init async Redis connection."""
        if self._redis is not None:
            return self._redis

        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=2.0,
            )
            # Test connection
            await self._redis.ping()
            logger.info("Redis connected for Fusion data")
        except Exception as e:
            logger.warning(f"Redis unavailable for Fusion data: {e}")
            self._redis = None

        return self._redis

    async def get_latest_price(self, symbol: str) -> dict | None:
        """Get latest close price from Redis (shared with Event Fusion Engine)."""
        redis = await self._get_redis()
        if not redis:
            return None

        try:
            key = f"latest_close:{symbol}"
            raw = await redis.get(key)
            if raw:
                return json.loads(raw)
        except Exception as e:
            logger.warning(f"Failed to get latest price for {symbol}: {e}")
        return None

    async def get_recent_news(self, symbol: str, lookback_sec: int = 600) -> list[dict]:
        """Get recent news items for a symbol from Redis."""
        redis = await self._get_redis()
        if not redis:
            return []

        try:
            key = f"news:{symbol}"
            now = time.time()
            cutoff = now - lookback_sec

            # News stored as sorted set with timestamp as score
            items = await redis.zrangebyscore(key, cutoff, now) or []
            return [json.loads(item) for item in items]
        except Exception as e:
            logger.warning(f"Failed to get news for {symbol}: {e}")
            return []

    async def get_recent_social(self, symbol: str, lookback_sec: int = 600) -> list[dict]:
        """Get recent social signals for a symbol from Redis."""
        redis = await self._get_redis()
        if not redis:
            return []

        try:
            key = f"social:{symbol}"
            now = time.time()
            cutoff = now - lookback_sec

            items = await redis.zrangebyscore(key, cutoff, now) or []
            return [json.loads(item) for item in items]
        except Exception as e:
            logger.warning(f"Failed to get social for {symbol}: {e}")
            return []

    async def get_fusion_context(self, symbol: str) -> dict:
        """
        Build a complete Triple Fusion context for a symbol.
        Combines market price, news, and social data.
        """
        price = await self.get_latest_price(symbol)
        news = await self.get_recent_news(symbol)
        social = await self.get_recent_social(symbol)

        news_count = len(news)
        social_count = len(social)

        return {
            "market": {
                "price": price.get("close", 0) if price else 0,
                "timestamp": price.get("ts", "") if price else "",
            },
            "news": {
                "count": news_count,
                "headlines": [n.get("headline", "") for n in news[:5]],
                "items": news[:3],
            },
            "social": {
                "count": social_count,
                "top_signals": [s.get("title", "") for s in social[:3]],
                "items": social[:3],
            },
            "severity": min(100, news_count * 8 + social_count * 5),
            "direction": "unknown",
        }

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()


# Singleton
fusion_client = FusionClient()
