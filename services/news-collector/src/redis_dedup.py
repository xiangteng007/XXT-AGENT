"""
Redis-based deduplication for news items.
"""
from __future__ import annotations
import redis
import hashlib


class Deduper:
    """Tracks seen news URLs to avoid publishing duplicates."""
    
    def __init__(self, host: str, port: int):
        self.r = redis.Redis(host=host, port=port, decode_responses=True)

    @staticmethod
    def _hash(s: str) -> str:
        """Generate a short hash for a URL."""
        return hashlib.sha1(s.encode("utf-8")).hexdigest()

    def key(self, url: str) -> str:
        """Generate Redis key for a URL."""
        return f"news:seen:{self._hash(url)}"

    def seen(self, url: str) -> bool:
        """Check if a URL has been seen before."""
        return self.r.get(self.key(url)) is not None

    def mark(self, url: str, ttl_sec: int) -> None:
        """Mark a URL as seen with TTL."""
        self.r.set(self.key(url), "1", ex=ttl_sec)
