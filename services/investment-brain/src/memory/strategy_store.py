"""
Strategy Memory Store

Stores successful/failed patterns and regime preferences
for the self-improving feedback loop.

Phase 1: In-memory + Firestore persistence
Phase 3: Will add vector search for similar pattern retrieval
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from ..graph.state import StrategyMemory

logger = logging.getLogger("investment-brain.memory.strategy_store")

# ── In-memory store ────────────────────────────────────────
_memory_cache: dict[str, StrategyMemory] = {}


def get_strategy_memory(user_id: str = "default") -> StrategyMemory | None:
    """Get strategy memory for a user."""
    return _memory_cache.get(user_id)


def update_strategy_memory(
    user_id: str = "default",
    memory: StrategyMemory | None = None,
) -> None:
    """Update strategy memory in cache."""
    if memory:
        _memory_cache[user_id] = memory
        logger.info(
            f"[StrategyStore] Updated memory for {user_id}: "
            f"{len(memory.get('successful_patterns', []))} success, "
            f"{len(memory.get('failed_patterns', []))} fail"
        )


def add_successful_pattern(
    pattern: str,
    user_id: str = "default",
) -> None:
    """Add a successful trading pattern to memory."""
    memory = _memory_cache.get(user_id) or StrategyMemory(
        successful_patterns=[],
        failed_patterns=[],
        regime_preferences={},
        last_updated=datetime.utcnow().isoformat(),
    )
    patterns = memory.get("successful_patterns", [])
    if pattern not in patterns:
        patterns.append(pattern)
        # Keep last 20
        memory["successful_patterns"] = patterns[-20:]
        memory["last_updated"] = datetime.utcnow().isoformat()
        _memory_cache[user_id] = memory


def add_failed_pattern(
    pattern: str,
    user_id: str = "default",
) -> None:
    """Add a failed trading pattern to memory."""
    memory = _memory_cache.get(user_id) or StrategyMemory(
        successful_patterns=[],
        failed_patterns=[],
        regime_preferences={},
        last_updated=datetime.utcnow().isoformat(),
    )
    patterns = memory.get("failed_patterns", [])
    if pattern not in patterns:
        patterns.append(pattern)
        memory["failed_patterns"] = patterns[-20:]
        memory["last_updated"] = datetime.utcnow().isoformat()
        _memory_cache[user_id] = memory


def get_all_memories() -> dict[str, StrategyMemory]:
    """Get all user memories (for debug/admin)."""
    return dict(_memory_cache)
