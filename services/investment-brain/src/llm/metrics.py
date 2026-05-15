"""
Node Metrics — Inference timing and observability for LangGraph nodes.

Tracks per-node execution times, LLM inference durations,
and error rates for monitoring and optimization.
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from functools import wraps
from typing import Any, Callable

logger = logging.getLogger("investment-brain.llm.metrics")


@dataclass
class NodeMetric:
    """Metrics for a single node execution."""
    node_name: str
    total_ms: float
    llm_ms: float = 0.0
    success: bool = True
    error: str = ""
    timestamp: float = field(default_factory=time.time)


class MetricsCollector:
    """
    In-memory metrics collector for LangGraph node performance.

    Stores the last N executions per node for health reporting.
    """

    def __init__(self, max_history: int = 100):
        self._history: dict[str, list[NodeMetric]] = defaultdict(list)
        self._max = max_history

    def record(self, metric: NodeMetric) -> None:
        """Record a node execution metric."""
        history = self._history[metric.node_name]
        history.append(metric)
        # Trim to max
        if len(history) > self._max:
            self._history[metric.node_name] = history[-self._max:]

        level = logging.INFO if metric.success else logging.WARNING
        logger.log(
            level,
            f"[Metrics] {metric.node_name}: total={metric.total_ms:.0f}ms, "
            f"llm={metric.llm_ms:.0f}ms, success={metric.success}"
            + (f", error={metric.error}" if metric.error else "")
        )

    def summary(self) -> dict[str, Any]:
        """Get per-node summary statistics."""
        result: dict[str, Any] = {}
        for name, entries in self._history.items():
            if not entries:
                continue
            recent = entries[-20:]  # Last 20
            total_times = [e.total_ms for e in recent]
            llm_times = [e.llm_ms for e in recent if e.llm_ms > 0]
            success_count = sum(1 for e in recent if e.success)

            result[name] = {
                "executions": len(entries),
                "recent_count": len(recent),
                "avg_total_ms": round(sum(total_times) / len(total_times), 1) if total_times else 0,
                "avg_llm_ms": round(sum(llm_times) / len(llm_times), 1) if llm_times else 0,
                "min_total_ms": round(min(total_times), 1) if total_times else 0,
                "max_total_ms": round(max(total_times), 1) if total_times else 0,
                "success_rate": round(success_count / len(recent) * 100, 1),
                "last_run": entries[-1].timestamp,
            }
        return result

    def reset(self) -> None:
        """Clear all stored metrics."""
        self._history.clear()


# Global singleton
metrics = MetricsCollector()


def timed_node(node_name: str):
    """
    Decorator for LangGraph node functions to automatically track timing.

    Usage:
        @timed_node("market_analyst")
        async def market_analyst_node(state):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.monotonic()
            error_msg = ""
            success = True
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                success = False
                error_msg = str(e)[:200]
                raise
            finally:
                elapsed_ms = (time.monotonic() - start) * 1000
                metrics.record(NodeMetric(
                    node_name=node_name,
                    total_ms=elapsed_ms,
                    success=success,
                    error=error_msg,
                ))
        return wrapper
    return decorator
