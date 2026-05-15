"""
Preference Collector — DPO Training Data

Collects user Accept/Reject pairs for Direct Preference Optimization.
Each analysis session can be rated by the user, producing (chosen, rejected)
pairs for DPO fine-tuning.

Usage:
    from .preference_collector import preference_collector

    # Record user accepting a plan
    await preference_collector.accept(session_id, symbol, plan_json)

    # Record user rejecting a plan
    await preference_collector.reject(session_id, symbol, plan_json)

    # Export DPO pairs
    pairs = await preference_collector.export_dpo_pairs(limit=100)
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("investment-brain.training.preference")

REDIS_KEY_ACCEPTED = "training:preferences:accepted"
REDIS_KEY_REJECTED = "training:preferences:rejected"
REDIS_KEY_STATS = "training:preferences:stats"


@dataclass
class PreferenceEntry:
    """A single preference data point."""
    session_id: str
    symbol: str
    instruction: str
    output: str
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "symbol": self.symbol,
            "instruction": self.instruction,
            "output": self.output,
            "timestamp": self.timestamp,
        }


class PreferenceCollector:
    """
    Collects Accept/Reject preferences for DPO training.

    DPO requires (chosen, rejected) pairs of responses to the same prompt.
    We collect these by:
    1. User accepts an analysis → goes to 'accepted' list
    2. User rejects an analysis → goes to 'rejected' list
    3. We pair accepted/rejected entries by symbol similarity for DPO training
    """

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self._redis_url = redis_url
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(self._redis_url)
                await self._redis.ping()
            except Exception as e:
                logger.warning(f"Redis unavailable for preferences: {e}")
                self._redis = None
        return self._redis

    async def accept(
        self,
        session_id: str,
        symbol: str,
        plan: dict[str, Any],
        user_query: str = "",
    ) -> None:
        """Record that the user accepted this analysis."""
        entry = PreferenceEntry(
            session_id=session_id,
            symbol=symbol,
            instruction=user_query or f"分析 {symbol} 並提供投資建議",
            output=json.dumps(plan, ensure_ascii=False, default=str),
        )

        r = await self._get_redis()
        if r:
            await r.lpush(REDIS_KEY_ACCEPTED, json.dumps(entry.to_dict(), ensure_ascii=False))
            await r.hincrby(REDIS_KEY_STATS, "accepted", 1)
            logger.info(f"[Preference] Accepted: {symbol} / {session_id}")

    async def reject(
        self,
        session_id: str,
        symbol: str,
        plan: dict[str, Any],
        user_query: str = "",
        reason: str = "",
    ) -> None:
        """Record that the user rejected this analysis."""
        entry_dict = PreferenceEntry(
            session_id=session_id,
            symbol=symbol,
            instruction=user_query or f"分析 {symbol} 並提供投資建議",
            output=json.dumps(plan, ensure_ascii=False, default=str),
        ).to_dict()
        entry_dict["rejection_reason"] = reason

        r = await self._get_redis()
        if r:
            await r.lpush(REDIS_KEY_REJECTED, json.dumps(entry_dict, ensure_ascii=False))
            await r.hincrby(REDIS_KEY_STATS, "rejected", 1)
            logger.info(f"[Preference] Rejected: {symbol} / {session_id} ({reason})")

    async def get_stats(self) -> dict:
        """Get preference collection statistics."""
        r = await self._get_redis()
        if not r:
            return {"accepted": 0, "rejected": 0, "dpo_pairs": 0}

        accepted = await r.llen(REDIS_KEY_ACCEPTED)
        rejected = await r.llen(REDIS_KEY_REJECTED)

        return {
            "accepted": accepted,
            "rejected": rejected,
            "dpo_pairs": min(accepted, rejected),
            "ready_for_dpo": min(accepted, rejected) >= 50,
        }

    async def export_dpo_pairs(self, limit: int = 100) -> list[dict]:
        """
        Export DPO training pairs in (chosen, rejected) format.

        Pairs are created by matching accepted and rejected entries.
        Prioritizes same-symbol matches for higher quality pairs.
        """
        r = await self._get_redis()
        if not r:
            return []

        accepted_raw = await r.lrange(REDIS_KEY_ACCEPTED, 0, limit - 1)
        rejected_raw = await r.lrange(REDIS_KEY_REJECTED, 0, limit - 1)

        accepted = [json.loads(a) for a in accepted_raw]
        rejected = [json.loads(j) for j in rejected_raw]

        if not accepted or not rejected:
            return []

        pairs = []

        # Phase 1: Match by same symbol
        rejected_by_symbol: dict[str, list[dict]] = {}
        for r_entry in rejected:
            sym = r_entry.get("symbol", "")
            rejected_by_symbol.setdefault(sym, []).append(r_entry)

        used_rejected = set()
        for a_entry in accepted:
            sym = a_entry.get("symbol", "")
            candidates = rejected_by_symbol.get(sym, [])
            for i, r_entry in enumerate(candidates):
                r_id = r_entry.get("session_id", id(r_entry))
                if r_id not in used_rejected:
                    pairs.append({
                        "prompt": a_entry["instruction"],
                        "chosen": a_entry["output"],
                        "rejected": r_entry["output"],
                        "symbol": sym,
                        "match_type": "same_symbol",
                    })
                    used_rejected.add(r_id)
                    break

        # Phase 2: Cross-symbol pairs for remaining
        remaining_accepted = [a for a in accepted if not any(
            p.get("chosen") == a["output"] for p in pairs
        )]
        remaining_rejected = [r for r in rejected if r.get("session_id") not in used_rejected]

        for a_entry, r_entry in zip(remaining_accepted, remaining_rejected):
            pairs.append({
                "prompt": a_entry["instruction"],
                "chosen": a_entry["output"],
                "rejected": r_entry["output"],
                "symbol": a_entry.get("symbol", ""),
                "match_type": "cross_symbol",
            })

        logger.info(f"[Preference] Exported {len(pairs)} DPO pairs")
        return pairs[:limit]

    async def close(self):
        if self._redis:
            await self._redis.close()
            self._redis = None


# Module-level singleton
preference_collector = PreferenceCollector()
