"""
Redis store for user watchlists.
"""
from __future__ import annotations
import logging
import redis

logger = logging.getLogger("telegram-command-bot")


class WatchStore:
    """Manages user watchlists in Redis with lazy connection."""
    
    def __init__(self, host: str, port: int):
        self._host = host
        self._port = port
        self._redis: redis.Redis | None = None

    def _get_redis(self) -> redis.Redis | None:
        """Get Redis connection, creating it if needed."""
        if self._redis is None:
            try:
                self._redis = redis.Redis(
                    host=self._host, 
                    port=self._port, 
                    decode_responses=True,
                    socket_timeout=5,
                    socket_connect_timeout=5,
                )
                # Test connection
                self._redis.ping()
            except Exception as e:
                logger.warning(f"Redis not available: {e}")
                self._redis = None
        return self._redis

    def key(self, chat_id: str) -> str:
        """Generate Redis key for user watchlist."""
        return f"tg:watch:{chat_id}"

    def add(self, chat_id: str, symbol: str) -> None:
        """Add symbol to user's watchlist."""
        r = self._get_redis()
        if r:
            try:
                r.sadd(self.key(chat_id), symbol.upper())
            except Exception as e:
                logger.warning(f"Failed to add to watchlist: {e}")

    def remove(self, chat_id: str, symbol: str) -> None:
        """Remove symbol from user's watchlist."""
        r = self._get_redis()
        if r:
            try:
                r.srem(self.key(chat_id), symbol.upper())
            except Exception as e:
                logger.warning(f"Failed to remove from watchlist: {e}")

    def list(self, chat_id: str) -> list[str]:
        """Get user's watchlist as sorted list."""
        r = self._get_redis()
        if r:
            try:
                vals = r.smembers(self.key(chat_id))
                return sorted(list(vals))
            except Exception as e:
                logger.warning(f"Failed to get watchlist: {e}")
        return []

