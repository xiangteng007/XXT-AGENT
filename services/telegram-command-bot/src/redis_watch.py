"""
Redis store for user watchlists.
"""
from __future__ import annotations
import redis


class WatchStore:
    """Manages user watchlists in Redis."""
    
    def __init__(self, host: str, port: int):
        self.r = redis.Redis(host=host, port=port, decode_responses=True)

    def key(self, chat_id: str) -> str:
        """Generate Redis key for user watchlist."""
        return f"tg:watch:{chat_id}"

    def add(self, chat_id: str, symbol: str) -> None:
        """Add symbol to user's watchlist."""
        self.r.sadd(self.key(chat_id), symbol.upper())

    def remove(self, chat_id: str, symbol: str) -> None:
        """Remove symbol from user's watchlist."""
        self.r.srem(self.key(chat_id), symbol.upper())

    def list(self, chat_id: str) -> list[str]:
        """Get user's watchlist as sorted list."""
        vals = self.r.smembers(self.key(chat_id))
        return sorted(list(vals))
