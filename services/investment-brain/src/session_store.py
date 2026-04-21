"""
Investment Brain — Redis Session Store  (A-1 / P2)

解決問題：原本的 _sessions: dict[str, dict] 為 in-memory，
Cloud Run 或工作站重啟即丟失所有進行中的分析 session。

設計：
  - 優先使用 Redis（非同步 redis.asyncio）
  - Redis 不可用時自動 fallback 至 in-memory（開發環境友善）
  - Session TTL 預設 24 小時
  - Key 命名空間: ib:session:{session_id}

環境變數：
  REDIS_URL=redis://localhost:6379   (或 GCP Memorystore URL)
  SESSION_TTL_SECONDS=86400          (選填, 預設 24h)
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger("investment-brain.session")


# ── 嘗試引入 redis.asyncio ────────────────────────────────────
try:
    from redis.asyncio import Redis, ConnectionError as RedisConnectionError  # type: ignore
    _redis_available = True
except ImportError:
    _redis_available = False
    logger.warning("[SessionStore] redis package not installed — using in-memory fallback")


class RedisSessionStore:
    """
    Redis-backed session store with in-memory fallback.

    使用方法（lifespan 中初始化）：
        session_store = RedisSessionStore(redis_url=settings.redis_url)
        await session_store.connect()
        ...
        await session_store.close()
    """

    KEY_PREFIX = "ib:session:"
    DEFAULT_TTL = 86_400  # 24 hours

    def __init__(self, redis_url: str, ttl_seconds: int = DEFAULT_TTL):
        self._redis_url = redis_url
        self._ttl = ttl_seconds
        self._redis: "Redis | None" = None
        self._fallback: dict[str, dict] = {}   # in-memory fallback
        self._using_redis = False

    async def connect(self) -> None:
        """嘗試連線 Redis；失敗則降級至 in-memory。"""
        if not _redis_available:
            logger.warning("[SessionStore] redis.asyncio unavailable — in-memory mode")
            return

        try:
            self._redis = Redis.from_url(
                self._redis_url,
                decode_responses=True,
                socket_connect_timeout=3,
            )
            # Ping 確認連線
            await self._redis.ping()
            self._using_redis = True
            logger.info(f"[SessionStore] Connected to Redis: {self._redis_url}")
        except Exception as exc:
            logger.warning(
                f"[SessionStore] Redis unavailable ({exc}) — falling back to in-memory"
            )
            self._redis = None
            self._using_redis = False

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()
            logger.info("[SessionStore] Redis connection closed")

    # ── CRUD ────────────────────────────────────────────────

    async def set(self, session_id: str, data: dict[str, Any]) -> None:
        """儲存 session；序列化為 JSON。"""
        payload = json.dumps(data, default=str)  # default=str handles datetime
        if self._using_redis and self._redis:
            await self._redis.setex(
                f"{self.KEY_PREFIX}{session_id}", self._ttl, payload
            )
        else:
            self._fallback[session_id] = data

    async def get(self, session_id: str) -> dict[str, Any] | None:
        """讀取 session；不存在回傳 None。"""
        if self._using_redis and self._redis:
            raw = await self._redis.get(f"{self.KEY_PREFIX}{session_id}")
            if raw is None:
                return None
            return json.loads(raw)
        return self._fallback.get(session_id)

    async def delete(self, session_id: str) -> None:
        """刪除 session。"""
        if self._using_redis and self._redis:
            await self._redis.delete(f"{self.KEY_PREFIX}{session_id}")
        else:
            self._fallback.pop(session_id, None)

    async def count(self) -> int:
        """目前 session 數量（用於 /health 端點）。"""
        if self._using_redis and self._redis:
            try:
                # C-05: Use SCAN instead of KEYS to avoid O(N) blocking
                count = 0
                async for _ in self._redis.scan_iter(match=f"{self.KEY_PREFIX}*", count=100):
                    count += 1
                return count
            except Exception:
                return 0
        return len(self._fallback)

    async def list_recent(self, limit: int = 20) -> list[dict]:
        """列出最近的 sessions（/invest/sessions 端點使用）。"""
        if self._using_redis and self._redis:
            try:
                # C-05: Use SCAN cursor instead of KEYS * to avoid blocking
                sessions: list[dict] = []
                async for key in self._redis.scan_iter(
                    match=f"{self.KEY_PREFIX}*", count=100
                ):
                    if len(sessions) >= limit * 2:  # collect 2x then sort
                        break
                    raw = await self._redis.get(key)
                    if raw:
                        sessions.append(json.loads(raw))
                # Sort by completed_at descending
                sessions.sort(
                    key=lambda s: s.get("completed_at") or "", reverse=True
                )
                return sessions[:limit]
            except Exception as exc:
                logger.error(f"[SessionStore] list_recent error: {exc}")
                return []
        else:
            items = sorted(
                self._fallback.values(),
                key=lambda s: s.get("completed_at") or "",
                reverse=True,
            )
            return items[:limit]

    # ── 診斷 ────────────────────────────────────────────────

    @property
    def backend(self) -> str:
        return "redis" if self._using_redis else "in-memory"

    def status(self) -> dict:
        return {
            "backend": self.backend,
            "redis_url": self._redis_url if self._using_redis else None,
            "ttl_seconds": self._ttl,
        }
