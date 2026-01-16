"""
Redis store for reading recent news (shared with event-fusion-engine).
"""
from __future__ import annotations
import redis
import orjson
import time


class PlannerStore:
    """Read recent news from fusion store."""
    
    def __init__(self, host: str, port: int):
        self.r = redis.Redis(host=host, port=port, decode_responses=True)

    def news_key(self, symbol: str) -> str:
        """Generate Redis key for symbol news list."""
        return f"fusion:news:{symbol}"

    def social_key(self, symbol: str) -> str:
        """Generate Redis key for symbol social list."""
        return f"fusion:social:{symbol}"

    def get_recent_news(self, symbol: str, lookback_sec: int) -> list[dict]:
        """Get recent news within lookback window."""
        raw = self.r.lrange(self.news_key(symbol), 0, 20)
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
        raw = self.r.lrange(self.social_key(symbol), 0, 20)
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
