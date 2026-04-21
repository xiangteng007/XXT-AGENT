"""
Tools — Fusion Engine Client

Retrieves Triple Fusion data (market + news + social) from the
existing Event Fusion Engine via Redis shared state.
"""
from __future__ import annotations

import json
import logging
import time
import difflib
from typing import Any

import httpx
from pydantic import BaseModel, Field

from ..config import settings

logger = logging.getLogger("investment-brain.tools.fusion_client")

class SocialPost(BaseModel):
    platform: str
    author: str
    title: str
    content: str
    engagement: dict = Field(default_factory=dict)
    sentiment: str = "unknown"
    is_mock: bool = False
    source_tier: str = "unknown"
    verified_account: bool = False
    published_at: str = ""

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
        """Get recent social signals for a symbol from Redis and Stocktwits."""
        redis = await self._get_redis()
        items = []
        if redis:
            try:
                key = f"social:{symbol}"
                now = time.time()
                cutoff = now - lookback_sec
                raw_items = await redis.zrangebyscore(key, cutoff, now) or []
                items = [json.loads(item) for item in raw_items]
            except Exception as e:
                logger.warning(f"Failed to get social for {symbol} from Redis: {e}")
        
        # P4-01: StocktwitsAdapter
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"https://api.stocktwits.com/api/2/streams/symbol/{symbol}.json")
                if res.status_code == 200:
                    data = res.json()
                    for msg in data.get("messages", [])[:5]:
                        user = msg.get("user", {})
                        items.append(SocialPost(
                            platform="Stocktwits",
                            author=user.get("username", "Unknown"),
                            title=f"Stocktwits: {symbol}",
                            content=msg.get("body", ""),
                            engagement={"likes": msg.get("likes", {}).get("total", 0)},
                            sentiment=msg.get("entities", {}).get("sentiment", {}).get("basic", "unknown") if msg.get("entities", {}).get("sentiment") else "unknown",
                            is_mock=False,
                            source_tier="community",
                            verified_account=user.get("official", False),
                            published_at=msg.get("created_at", "")
                        ).model_dump())
        except Exception as e:
            logger.warning(f"Stocktwits fetch failed for {symbol}: {e}")

        # Fallback mock data if still empty
        if not items:
            items = [
                SocialPost(
                    platform="X (Twitter)",
                    author="WhaleAlert",
                    title=f"Large movement detected for {symbol}",
                    content=f"🚨 🚨 🚨 Significant volume spike observed on {symbol} options chain.",
                    engagement={"views": 125000, "likes": 4200, "reposts": 850},
                    sentiment="bullish",
                    is_mock=True,
                    source_tier="unverified"
                ).model_dump(),
                SocialPost(
                    platform="Reddit (r/investing)",
                    author="MarketWatcher_99",
                    title=f"Thoughts on {symbol} earnings call?",
                    content=f"The forward guidance looks surprisingly weak despite the headline beat.",
                    engagement={"upvotes": 342, "comments": 89},
                    sentiment="bearish",
                    is_mock=True,
                    source_tier="community"
                ).model_dump(),
            ]
            
        return items

    async def get_fusion_context(self, symbol: str) -> dict:
        """
        Build a complete Triple Fusion context for a symbol.
        Combines market price, news, and social data.
        """
        price = await self.get_latest_price(symbol)
        news = await self.get_recent_news(symbol)
        social = await self.get_recent_social(symbol)

        # P4-03: Deduplicate news by headline fingerprint
        deduplicated_news: list[dict] = []
        for n in news:
            headline = n.get("headline", "").strip()
            if not headline:
                continue
            is_dup = False
            for seen in deduplicated_news:
                seen_hl = seen.get("headline", "").strip()
                if difflib.SequenceMatcher(None, headline.lower(), seen_hl.lower()).ratio() > 0.8:
                    is_dup = True
                    break
            if not is_dup:
                deduplicated_news.append(n)
        news = deduplicated_news

        SOURCE_CREDIBILITY_TIER = {
            "reuters.com": 5, "bloomberg.com": 5,
            "cnbc.com": 4, "yahoo finance": 3
        }
        total_cred = 0
        total_sent = 0.0
        for n in news:
            source = str(n.get("source", "")).lower()
            cred = 1
            for k, v in SOURCE_CREDIBILITY_TIER.items():
                if k in source:
                    cred = v
                    break
            n["credibility"] = cred
            
            # Simple sentiment parsing if exists (mocking to 0.0 if not a number)
            s = n.get("sentiment", 0.0)
            if isinstance(s, str):
                s = 1.0 if s.lower() == "bullish" else (-1.0 if s.lower() == "bearish" else 0.0)
            elif not isinstance(s, (int, float)):
                s = 0.0
            
            total_sent += float(s) * cred
            total_cred += cred
            
        cred_weighted_sentiment = (total_sent / total_cred) if total_cred > 0 else 0.0

        news_count = len(news)
        social_count = len(social)
        mock_count = sum(1 for s in social if s.get("is_mock", False))

        raw_fusion = {
            "market": {
                "price": price.get("close", 0) if price else 0,
                "timestamp": price.get("ts", "") if price else "",
            },
            "news": {
                "count": news_count,
                "headlines": [n.get("headline", "") for n in news[:5]],
                "items": news[:3],
                "deduplicated": True,  # P4-03
                "credibility_weighted_sentiment": cred_weighted_sentiment,
            },
            "social": {
                "count": social_count,
                "mock_count": mock_count,  # P4-01: LLM can see how many are mock
                "top_signals": [s.get("title", "") for s in social[:3]],
                "items": social[:3],
                "data_quality": "mock" if mock_count == social_count else ("partial" if mock_count > 0 else "live"),
            },
            "severity": min(100, news_count * 8 + social_count * 5),
            "direction": "unknown",
        }
        
        try:
            from pydantic import BaseModel, Field
            class FusionMarket(BaseModel):
                price: float = 0.0
                timestamp: str = ""
            class FusionNews(BaseModel):
                count: int = 0
                headlines: list[str] = Field(default_factory=list)
                items: list[dict] = Field(default_factory=list)
                deduplicated: bool = False
                credibility_weighted_sentiment: float = 0.0
            class FusionSocial(BaseModel):
                count: int = 0
                mock_count: int = 0
                top_signals: list[str] = Field(default_factory=list)
                items: list[dict] = Field(default_factory=list)
                data_quality: str = "mock"
            class FusionContextSchema(BaseModel):
                market: FusionMarket = Field(default_factory=FusionMarket)
                news: FusionNews = Field(default_factory=FusionNews)
                social: FusionSocial = Field(default_factory=FusionSocial)
                severity: float = 0.0
                direction: str = "unknown"
                
            validated = FusionContextSchema.model_validate(raw_fusion)
            return validated.model_dump()
        except Exception as e:
            logger.error(f"Failed to validate fusion context schema: {e}")
            return raw_fusion

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()


# Singleton
fusion_client = FusionClient()
