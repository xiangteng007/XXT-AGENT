"""
Rate limiting middleware for telegram-command-bot.
Per-user, per-command token bucket via Redis.
"""
import time
import logging
from typing import Callable, Awaitable

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# Per-command limits: (max_calls, window_seconds)
RATE_LIMITS: dict[str, tuple[int, int]] = {
    "/analyze":   (3, 60),    # AI-heavy: 3/min
    "/ai":        (10, 60),   # 10/min
    "/estimator": (5, 60),    # construction cost: 5/min
    "/interior":  (5, 60),
    "/scout":     (5, 60),
    "/ins":       (20, 60),   # light queries
    "/loan":      (20, 60),
    "/acc":       (20, 60),
    "/news":      (30, 60),   # cache-backed: generous
    "default":    (30, 60),   # all other commands
}


class RateLimiter:
    """Redis-backed per-user rate limiter."""

    def __init__(self, redis_host: str, redis_port: int = 6379):
        self._redis: aioredis.Redis | None = None
        self._host = redis_host
        self._port = redis_port

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = await aioredis.from_url(
                f"redis://{self._host}:{self._port}",
                encoding="utf-8",
                decode_responses=True,
            )
        return self._redis

    async def is_allowed(self, user_id: int, command: str) -> tuple[bool, int]:
        """
        Check if the user is within rate limit for the given command.
        Returns (allowed, retry_after_seconds).
        """
        max_calls, window = RATE_LIMITS.get(command, RATE_LIMITS["default"])
        key = f"rl:{command.lstrip('/')}:{user_id}"

        try:
            r = await self._get_redis()
            now = int(time.time())
            window_start = now - window

            pipe = r.pipeline()
            # Remove old entries outside the window
            pipe.zremrangebyscore(key, 0, window_start)
            # Count entries in window
            pipe.zcard(key)
            # Add current request
            pipe.zadd(key, {str(now): now})
            # Set TTL
            pipe.expire(key, window)
            results = await pipe.execute()

            count = results[1]  # zcard result

            if count >= max_calls:
                # Oldest entry time + window = when they can retry
                oldest = await r.zrange(key, 0, 0, withscores=True)
                retry_after = window
                if oldest:
                    retry_after = int(oldest[0][1]) + window - now
                return False, max(1, retry_after)

            return True, 0

        except Exception as e:
            logger.warning(f"RateLimiter error (allowing through): {e}")
            return True, 0  # Fail open to avoid blocking users on Redis issues

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()


# Module-level singleton (initialized in main.py startup)
_rate_limiter: RateLimiter | None = None


def init_rate_limiter(redis_host: str, redis_port: int = 6379) -> None:
    global _rate_limiter
    _rate_limiter = RateLimiter(redis_host, redis_port)


async def check_rate_limit(user_id: int, command: str) -> tuple[bool, int]:
    """Convenience function for handlers to check rate limits."""
    if _rate_limiter is None:
        return True, 0
    return await _rate_limiter.is_allowed(user_id, command)
