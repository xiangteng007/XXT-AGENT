"""
Redis store for fusion state: recent news and latest candle data.
"""
from __future__ import annotations
import redis
import time
import orjson


class FusionStore:
    """Store recent news per symbol and latest candle close."""

    def __init__(self, host: str, port: int):
        self.r = redis.Redis(host=host, port=port, decode_responses=True)

    def news_key(self, symbol: str) -> str:
        """Generate Redis key for symbol news list."""
        return f"fusion:news:{symbol}"

    def social_key(self, symbol: str) -> str:
        """Generate Redis key for symbol social list."""
        return f"fusion:social:{symbol}"

    def latest_close_key(self, symbol: str) -> str:
        """Generate Redis key for latest candle close."""
        return f"fusion:latest_close:{symbol}"

    def add_news(self, symbol: str, news: dict, ttl_sec: int = 7200) -> None:
        """Add news item to symbol's news list (LIFO, max 50 items)."""
        key = self.news_key(symbol)
        payload = orjson.dumps(news).decode("utf-8")
        pipe = self.r.pipeline()
        pipe.lpush(key, payload)
        pipe.ltrim(key, 0, 50)
        pipe.expire(key, ttl_sec)
        pipe.execute()

    def add_social(self, symbol: str, social: dict, ttl_sec: int = 7200) -> None:
        """Add social signal to symbol's social list (LIFO, max 50 items)."""
        key = self.social_key(symbol)
        payload = orjson.dumps(social).decode("utf-8")
        pipe = self.r.pipeline()
        pipe.lpush(key, payload)
        pipe.ltrim(key, 0, 50)
        pipe.expire(key, ttl_sec)
        pipe.execute()

    def get_recent_news(self, symbol: str, lookback_sec: int) -> list[dict]:
        """Get recent news within lookback window."""
        key = self.news_key(symbol)
        raw = self.r.lrange(key, 0, 50)
        now = int(time.time())
        out: list[dict] = []
        
        for s in raw:
            try:
                item = orjson.loads(s)
                ts = int(item.get("ts_unix", 0))
                if ts and (now - ts) <= lookback_sec:
                    out.append(item)
            except Exception:
                continue
        
        return out

    def get_recent_social(self, symbol: str, lookback_sec: int) -> list[dict]:
        """Get recent social signals within lookback window."""
        key = self.social_key(symbol)
        raw = self.r.lrange(key, 0, 50)
        now = int(time.time())
        out: list[dict] = []
        
        for s in raw:
            try:
                item = orjson.loads(s)
                ts = int(item.get("ts_unix", 0))
                if ts and (now - ts) <= lookback_sec:
                    out.append(item)
            except Exception:
                continue
        
        return out

    def set_latest_close(self, symbol: str, close: float, minute_ts_ms: int, ttl_sec: int = 21600) -> None:
        """Store latest candle close for reference."""
        key = self.latest_close_key(symbol)
        self.r.hset(key, mapping={"close": str(close), "minute_ts_ms": str(minute_ts_ms)})
        self.r.expire(key, ttl_sec)

    def get_latest_close(self, symbol: str) -> dict:
        """Get latest candle close data."""
        key = self.latest_close_key(symbol)
        return self.r.hgetall(key)
