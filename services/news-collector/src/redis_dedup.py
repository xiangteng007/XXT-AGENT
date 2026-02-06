"""
Redis-based deduplication for news items.
Falls back to in-memory set if Redis is unavailable.
"""
from __future__ import annotations
import redis
import hashlib
import logging

logger = logging.getLogger("news-collector")


class Deduper:
    """Tracks seen news URLs to avoid publishing duplicates."""
    
    def __init__(self, host: str, port: int):
        self._memory_cache: set[str] = set()
        self._use_redis = False
        self.r = None
        
        try:
            self.r = redis.Redis(host=host, port=port, decode_responses=True)
            # Test connection
            self.r.ping()
            self._use_redis = True
            logger.info(f"Connected to Redis at {host}:{port}")
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}), using in-memory dedup (not persistent across requests)")
            self._use_redis = False

    @staticmethod
    def _hash(s: str) -> str:
        """Generate a short hash for a URL."""
        return hashlib.sha1(s.encode("utf-8")).hexdigest()

    def key(self, url: str) -> str:
        """Generate Redis key for a URL."""
        return f"news:seen:{self._hash(url)}"

    def seen(self, url: str) -> bool:
        """Check if a URL has been seen before."""
        if self._use_redis:
            try:
                return self.r.get(self.key(url)) is not None
            except Exception:
                return False
        else:
            return self._hash(url) in self._memory_cache

    def mark(self, url: str, ttl_sec: int) -> None:
        """Mark a URL as seen with TTL."""
        if self._use_redis:
            try:
                self.r.set(self.key(url), "1", ex=ttl_sec)
            except Exception:
                pass
        else:
            self._memory_cache.add(self._hash(url))
