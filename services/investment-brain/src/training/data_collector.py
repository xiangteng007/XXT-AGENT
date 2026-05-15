"""
Training Data Collector — Captures LangGraph analysis I/O pairs.

Automatically records each full analysis run as a training example:
- Input: market context, fusion data, user query
- Output: generated plan, risk assessment
- Reward: based on backtest Sharpe ratio or simulated P&L

Data format compatible with Alpaca/ShareGPT for LoRA fine-tuning.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime
from typing import Any

logger = logging.getLogger("investment-brain.training.data_collector")


class TrainingDataCollector:
    """
    Collects analysis I/O pairs for offline model fine-tuning.

    Storage: Redis list + optional JSONL file export.
    Schema per example:
    {
        "id": "uuid",
        "timestamp": "ISO8601",
        "symbol": "2330.TW",
        "input": {
            "market_context": {...},
            "fusion_data": {...},
            "user_query": "分析 2330.TW",
            "risk_level": "moderate"
        },
        "output": {
            "market_insight": {...},
            "verification": {...},
            "investment_plan": {...},
            "risk_assessment": {...}
        },
        "reward": {
            "sharpe_ratio": 1.2,
            "total_return": 0.05,
            "json_parse_success": true,
            "conviction_score": 75,
            "risk_approved": true
        },
        "metadata": {
            "model": "qwen3:14b",
            "pipeline_duration_ms": 12500,
            "node_count": 6
        }
    }
    """

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self._redis_url = redis_url
        self._redis = None
        self._buffer: list[dict] = []
        self._redis_key = "training:examples"
        self._max_buffer = 500

    async def _get_redis(self):
        if self._redis is not None:
            return self._redis
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                self._redis_url, decode_responses=True, socket_timeout=2.0
            )
            await self._redis.ping()
            return self._redis
        except Exception as e:
            logger.warning(f"[DataCollector] Redis unavailable: {e}")
            self._redis = None
            return None

    async def record(
        self,
        symbol: str,
        market_context: dict,
        fusion_data: dict,
        user_query: str,
        risk_level: str,
        market_insight: dict | None,
        verification: dict | None,
        investment_plan: dict | None,
        risk_assessment: dict | None,
        backtest_metrics: dict | None = None,
        trade_results: list | None = None,
        pipeline_duration_ms: float = 0,
        model_name: str = "unknown",
    ) -> str:
        """Record a complete analysis run as a training example."""
        example_id = str(uuid.uuid4())[:12]

        # Calculate reward signals
        reward = self._compute_reward(
            market_insight=market_insight,
            investment_plan=investment_plan,
            risk_assessment=risk_assessment,
            backtest_metrics=backtest_metrics,
            trade_results=trade_results,
        )

        example = {
            "id": example_id,
            "timestamp": datetime.utcnow().isoformat(),
            "symbol": symbol,
            "input": {
                "market_context": _truncate(market_context, max_keys=10),
                "fusion_data": _truncate(fusion_data, max_keys=10),
                "user_query": user_query,
                "risk_level": risk_level,
            },
            "output": {
                "market_insight": _truncate(market_insight or {}, max_keys=15),
                "verification": _truncate(verification or {}, max_keys=10),
                "investment_plan": _truncate(investment_plan or {}, max_keys=15),
                "risk_assessment": _truncate(risk_assessment or {}, max_keys=10),
            },
            "reward": reward,
            "metadata": {
                "model": model_name,
                "pipeline_duration_ms": round(pipeline_duration_ms, 0),
                "node_count": 6,
            },
        }

        # Store in Redis
        redis = await self._get_redis()
        if redis:
            try:
                await redis.lpush(self._redis_key, json.dumps(example, ensure_ascii=False))
                await redis.ltrim(self._redis_key, 0, self._max_buffer - 1)
            except Exception as e:
                logger.warning(f"[DataCollector] Redis write failed: {e}")

        # In-memory buffer
        self._buffer.append(example)
        if len(self._buffer) > self._max_buffer:
            self._buffer = self._buffer[-self._max_buffer:]

        logger.info(
            f"[DataCollector] Recorded example {example_id} for {symbol} "
            f"(reward: sharpe={reward.get('sharpe_ratio', 'N/A')}, "
            f"conviction={reward.get('conviction_score', 'N/A')})"
        )
        return example_id

    def _compute_reward(
        self,
        market_insight: dict | None,
        investment_plan: dict | None,
        risk_assessment: dict | None,
        backtest_metrics: dict | None,
        trade_results: list | None,
    ) -> dict:
        """Compute reward signal from analysis outputs."""
        reward: dict[str, Any] = {
            "json_parse_success": True,
            "conviction_score": 0,
            "risk_approved": False,
            "sharpe_ratio": None,
            "total_return": None,
            "win_rate": None,
        }

        # JSON structural quality
        reward["json_parse_success"] = all([
            isinstance(market_insight, dict) and "regime" in (market_insight or {}),
            isinstance(investment_plan, dict) and "actions" in (investment_plan or {}),
        ])

        # Conviction from market insight
        if market_insight:
            reward["conviction_score"] = market_insight.get("conviction", 0)

        # Risk approval
        if isinstance(risk_assessment, dict):
            reward["risk_approved"] = risk_assessment.get("approved", False)

        # Backtest metrics
        if backtest_metrics and isinstance(backtest_metrics, dict):
            reward["sharpe_ratio"] = backtest_metrics.get("sharpe_ratio")
            reward["total_return"] = backtest_metrics.get("total_return")

        # Trade results
        if trade_results:
            wins = sum(1 for t in trade_results if t.get("pnl", 0) > 0)
            total = len([t for t in trade_results if t.get("status") == "executed"])
            if total > 0:
                reward["win_rate"] = round(wins / total * 100, 1)

        return reward

    async def export_alpaca(self, limit: int = 200) -> list[dict]:
        """Export training data in Alpaca format for LoRA fine-tuning."""
        redis = await self._get_redis()
        examples = []

        if redis:
            try:
                raw_items = await redis.lrange(self._redis_key, 0, limit - 1)
                examples = [json.loads(r) for r in raw_items]
            except Exception:
                pass

        if not examples:
            examples = self._buffer[-limit:]

        alpaca_data = []
        for ex in examples:
            inp = ex.get("input", {})
            out = ex.get("output", {})
            alpaca_data.append({
                "instruction": (
                    f"分析 {ex.get('symbol', '?')} 的投資機會。"
                    f"風險偏好: {inp.get('risk_level', 'moderate')}。"
                    f"用戶問題: {inp.get('user_query', '')}"
                ),
                "input": json.dumps(inp.get("market_context", {}), ensure_ascii=False)[:2000],
                "output": json.dumps(out.get("investment_plan", {}), ensure_ascii=False)[:3000],
            })

        return alpaca_data

    async def get_stats(self) -> dict:
        """Get training data collection statistics."""
        redis = await self._get_redis()
        count = 0
        if redis:
            try:
                count = await redis.llen(self._redis_key)
            except Exception:
                pass
        return {
            "total_examples": count or len(self._buffer),
            "buffer_size": len(self._buffer),
            "redis_connected": redis is not None,
        }

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()


def _truncate(data: dict, max_keys: int = 10) -> dict:
    """Truncate dict to avoid huge training examples."""
    if not isinstance(data, dict):
        return {}
    items = list(data.items())[:max_keys]
    return dict(items)


# Singleton
training_collector = TrainingDataCollector()
