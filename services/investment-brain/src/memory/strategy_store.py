"""
Strategy Memory Store  (F-01)
==============================

跨 session 的策略記憶系統，讓 evaluator 和 strategy_planner 能從歷史
成功/失敗模式中自我學習。

設計：
  - Redis Hash 持久化：ib:strategy_mem:{user_id}
  - 每個 user_id 保存最多 50 筆成功、50 筆失敗模式，以及市況偏好字典
  - Redis 不可用時自動 fallback 至 in-memory（開發環境友善）
  - 異步介面 + sync 包裝（供 LangGraph 節點呼叫）

資料格式（Redis Hash field → JSON string）：
  successful_patterns  → JSON list[str]
  failed_patterns      → JSON list[str]
  regime_preferences   → JSON dict[str, str]
  last_updated         → ISO8601 string

環境變數：
  REDIS_URL=redis://localhost:6379
  STRATEGY_MEMORY_TTL_SECONDS=2592000  (30 天，選填)
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger("investment-brain.memory.strategy_store")

# ── Redis import (graceful degradation) ────────────────────
try:
    from redis.asyncio import Redis, ConnectionError as RedisConnectionError  # type: ignore
    _redis_available = True
except ImportError:
    _redis_available = False
    logger.warning("[StrategyStore] redis package not installed — using in-memory fallback")


# ── Type alias ─────────────────────────────────────────────
from ..graph.state import StrategyMemory

# ── Constants ──────────────────────────────────────────────
_KEY_PREFIX            = "ib:strategy_mem:"
_MAX_PATTERNS          = 50          # max patterns per category per user
_DEFAULT_TTL_SECONDS   = 2_592_000   # 30 days


class StrategyMemoryStore:
    """
    F-01: Redis-backed cross-session strategy memory store.

    Usage (instantiate once in lifespan):
        store = StrategyMemoryStore(redis_url=settings.redis_url)
        await store.connect()
        ...
        await store.close()
    """

    def __init__(self, redis_url: str, ttl_seconds: int = _DEFAULT_TTL_SECONDS):
        self._redis_url     = redis_url
        self._ttl           = ttl_seconds
        self._redis: "Redis | None" = None
        self._fallback: dict[str, StrategyMemory] = {}
        self._using_redis   = False

    # ── Lifecycle ──────────────────────────────────────────

    async def connect(self) -> None:
        """Connect to Redis; fall back to in-memory on failure."""
        if not _redis_available:
            logger.warning("[StrategyStore] redis.asyncio unavailable — in-memory mode")
            return
        try:
            self._redis = Redis.from_url(
                self._redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
            )
            await self._redis.ping()
            self._using_redis = True
            logger.info(f"[StrategyStore] Connected to Redis: {self._redis_url}")
        except Exception as exc:
            logger.warning(f"[StrategyStore] Redis unavailable ({exc}) — in-memory fallback")
            self._redis = None
            self._using_redis = False

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()

    @property
    def backend(self) -> str:
        return "redis" if self._using_redis else "memory"

    # ── Internal helpers ───────────────────────────────────

    def _key(self, user_id: str) -> str:
        return f"{_KEY_PREFIX}{user_id}"

    async def _load(self, user_id: str) -> StrategyMemory:
        """Load memory from Redis or in-memory fallback."""
        if self._using_redis and self._redis:
            try:
                raw: dict[str, str] = await self._redis.hgetall(self._key(user_id))
                if raw:
                    return StrategyMemory(
                        successful_patterns=json.loads(raw.get("successful_patterns", "[]")),
                        failed_patterns=json.loads(raw.get("failed_patterns", "[]")),
                        regime_preferences=json.loads(raw.get("regime_preferences", "{}")),
                        last_updated=raw.get("last_updated", datetime.utcnow().isoformat()),
                    )
            except Exception as exc:
                logger.warning(f"[StrategyStore] Redis load error: {exc}")

        # Fallback / empty
        return self._fallback.get(user_id) or StrategyMemory(
            successful_patterns=[],
            failed_patterns=[],
            regime_preferences={},
            last_updated=datetime.utcnow().isoformat(),
        )

    async def _save(self, user_id: str, memory: StrategyMemory) -> None:
        """Persist memory to Redis (or in-memory fallback)."""
        memory["last_updated"] = datetime.utcnow().isoformat()
        if self._using_redis and self._redis:
            try:
                key = self._key(user_id)
                await self._redis.hset(key, mapping={  # type: ignore[arg-type]
                    "successful_patterns": json.dumps(memory.get("successful_patterns", []), ensure_ascii=False),
                    "failed_patterns":     json.dumps(memory.get("failed_patterns", []), ensure_ascii=False),
                    "regime_preferences":  json.dumps(memory.get("regime_preferences", {}), ensure_ascii=False),
                    "last_updated":        memory["last_updated"],
                })
                await self._redis.expire(key, self._ttl)
                return
            except Exception as exc:
                logger.warning(f"[StrategyStore] Redis save error: {exc} — falling back to memory")

        # In-memory fallback
        self._fallback[user_id] = memory

    # ── Public API ─────────────────────────────────────────

    async def get(self, user_id: str = "default") -> StrategyMemory | None:
        """Get strategy memory for a user. Returns None if empty."""
        memory = await self._load(user_id)
        if not memory.get("successful_patterns") and not memory.get("failed_patterns"):
            return None
        return memory

    async def add_successful_pattern(
        self,
        pattern: str,
        symbol: str | None = None,
        user_id: str = "default",
    ) -> None:
        """Record a successful strategy pattern.

        Args:
            pattern: Human-readable pattern description (e.g. "MACD crossover + volume surge → breakout")
            symbol:  Optional stock symbol for context tagging
            user_id: User/strategy namespace
        """
        memory = await self._load(user_id)
        entry = f"[{symbol}] {pattern}" if symbol else pattern
        patterns = memory.get("successful_patterns", [])
        if entry not in patterns:
            patterns.append(entry)
            memory["successful_patterns"] = patterns[-_MAX_PATTERNS:]
            await self._save(user_id, memory)
            logger.info(f"[StrategyStore] Added success: {entry[:60]}...")

    async def add_failed_pattern(
        self,
        pattern: str,
        symbol: str | None = None,
        user_id: str = "default",
    ) -> None:
        """Record a failed strategy pattern."""
        memory = await self._load(user_id)
        entry = f"[{symbol}] {pattern}" if symbol else pattern
        patterns = memory.get("failed_patterns", [])
        if entry not in patterns:
            patterns.append(entry)
            memory["failed_patterns"] = patterns[-_MAX_PATTERNS:]
            await self._save(user_id, memory)
            logger.info(f"[StrategyStore] Added failure: {entry[:60]}...")

    async def update_regime_preference(
        self,
        regime: str,
        preferred_strategy: str,
        user_id: str = "default",
    ) -> None:
        """Update market-regime to strategy mapping.

        Args:
            regime:             Market regime (e.g. "bull_trending", "bear_volatile", "sideways")
            preferred_strategy: Best-performing strategy name in this regime
            user_id:            User/strategy namespace
        """
        memory = await self._load(user_id)
        prefs = memory.get("regime_preferences", {})
        prefs[regime] = preferred_strategy
        memory["regime_preferences"] = prefs
        await self._save(user_id, memory)
        logger.info(f"[StrategyStore] Regime '{regime}' → '{preferred_strategy}'")

    async def build_memory_prompt_fragment(self, user_id: str = "default") -> str:
        """Generate a concise prompt fragment summarizing user's strategy memory.

        This is injected into the strategy_planner and evaluator prompts
        to enable self-improving behaviour across sessions.
        """
        memory = await self.get(user_id)
        if not memory:
            return ""

        lines: list[str] = ["### 歷史策略記憶（跨 Session 自我改進）"]

        success = memory.get("successful_patterns", [])
        if success:
            lines.append("\n**✅ 已驗證成功模式（優先考慮）：**")
            for p in success[-5:]:  # show last 5
                lines.append(f"  - {p}")

        failed = memory.get("failed_patterns", [])
        if failed:
            lines.append("\n**❌ 已知失敗模式（應避免）：**")
            for p in failed[-5:]:
                lines.append(f"  - {p}")

        regime_prefs = memory.get("regime_preferences", {})
        if regime_prefs:
            lines.append("\n**📊 市況偏好策略：**")
            for regime, strategy in regime_prefs.items():
                lines.append(f"  - {regime} → {strategy}")

        last = memory.get("last_updated", "")
        if last:
            lines.append(f"\n_記憶最後更新：{last[:10]}_")

        return "\n".join(lines)

    async def clear(self, user_id: str = "default") -> None:
        """Clear all memory for a user (admin/debug use)."""
        if self._using_redis and self._redis:
            try:
                await self._redis.delete(self._key(user_id))
            except Exception:
                pass
        self._fallback.pop(user_id, None)
        logger.info(f"[StrategyStore] Cleared memory for {user_id}")


# ── Backward-compat shim (sync, in-memory only) ────────────
# Used by existing sync callers before F-01 migration.

_legacy_cache: dict[str, StrategyMemory] = {}


def get_strategy_memory(user_id: str = "default") -> StrategyMemory | None:
    """Legacy sync accessor — returns in-memory only. Prefer StrategyMemoryStore."""
    return _legacy_cache.get(user_id)


def update_strategy_memory(user_id: str = "default", memory: StrategyMemory | None = None) -> None:
    """Legacy sync updater — updates in-memory cache only."""
    if memory:
        _legacy_cache[user_id] = memory


def add_successful_pattern(pattern: str, user_id: str = "default") -> None:
    """Legacy sync — in-memory only. Use StrategyMemoryStore.add_successful_pattern() in new code."""
    memory = _legacy_cache.get(user_id) or StrategyMemory(
        successful_patterns=[], failed_patterns=[], regime_preferences={},
        last_updated=datetime.utcnow().isoformat(),
    )
    patterns = memory.get("successful_patterns", [])
    if pattern not in patterns:
        patterns.append(pattern)
        memory["successful_patterns"] = patterns[-_MAX_PATTERNS:]
        memory["last_updated"] = datetime.utcnow().isoformat()
        _legacy_cache[user_id] = memory


def add_failed_pattern(pattern: str, user_id: str = "default") -> None:
    """Legacy sync — in-memory only."""
    memory = _legacy_cache.get(user_id) or StrategyMemory(
        successful_patterns=[], failed_patterns=[], regime_preferences={},
        last_updated=datetime.utcnow().isoformat(),
    )
    patterns = memory.get("failed_patterns", [])
    if pattern not in patterns:
        patterns.append(pattern)
        memory["failed_patterns"] = patterns[-_MAX_PATTERNS:]
        memory["last_updated"] = datetime.utcnow().isoformat()
        _legacy_cache[user_id] = memory


def get_all_memories() -> dict[str, StrategyMemory]:
    """Legacy — returns in-memory only."""
    return dict(_legacy_cache)
