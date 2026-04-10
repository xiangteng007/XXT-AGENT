"""
Trajectory Store

Records the complete decision trajectory of each analysis session
for later evaluation by the feedback loop.

Phase 1: In-memory + Firestore persistence
Phase 3: Will add vector indexing for similarity search
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger("investment-brain.memory.trajectory_store")

# ── In-memory trajectory log ───────────────────────────────
_trajectories: dict[str, dict] = {}


def record_trajectory(
    session_id: str,
    symbol: str,
    state_snapshot: dict,
) -> None:
    """Record a complete decision trajectory for later evaluation."""
    _trajectories[session_id] = {
        "session_id": session_id,
        "symbol": symbol,
        "recorded_at": datetime.utcnow().isoformat(),
        "market_insight": state_snapshot.get("market_insight"),
        "investment_plan": state_snapshot.get("investment_plan"),
        "risk_assessment": state_snapshot.get("risk_assessment"),
        "trade_results": state_snapshot.get("trade_results", []),
        "messages": [
            msg.content if hasattr(msg, "content") else str(msg)
            for msg in state_snapshot.get("messages", [])
        ],
    }
    logger.info(f"[TrajectoryStore] Recorded trajectory: {session_id[:8]}")


def get_trajectory(session_id: str) -> dict | None:
    """Get a stored trajectory by session ID."""
    return _trajectories.get(session_id)


def get_recent_trajectories(
    symbol: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """Get recent trajectories, optionally filtered by symbol."""
    items = list(_trajectories.values())

    if symbol:
        items = [t for t in items if t.get("symbol") == symbol]

    items.sort(key=lambda t: t.get("recorded_at", ""), reverse=True)
    return items[:limit]


def get_trajectory_count() -> int:
    """Get total number of stored trajectories."""
    return len(_trajectories)
