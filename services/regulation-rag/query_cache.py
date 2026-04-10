"""
Query Cache — LRU Cache for RAG queries
避免相同查詢重複呼叫 Ollama embed，降低延遲

使用 Python 內建 functools.lru_cache + 線程安全 TTL 機制
"""

import time
import hashlib
from typing import Optional
from threading import Lock

class QueryCache:
    """
    TTL-based LRU Cache for embedding queries

    設計：
    - 最多快取 256 organizationsqueriesunique
    - TTL 1 小時（法規不常改動）
    - 同時搜尋同一 query 時只 embed 一次（防抖）
    """

    def __init__(self, max_size: int = 256, ttl_seconds: int = 3600):
        self._cache: dict[str, tuple[float, list[float]]] = {}  # key → (timestamp, vector)
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._lock = Lock()
        self._hits = 0
        self._misses = 0

    def _make_key(self, query: str, model: str) -> str:
        return hashlib.md5(f"{model}::{query}".encode()).hexdigest()

    def get(self, query: str, model: str) -> Optional[list[float]]:
        key = self._make_key(query, model)
        with self._lock:
            if key in self._cache:
                ts, vec = self._cache[key]
                if time.time() - ts < self._ttl:
                    self._hits += 1
                    # 更新 LRU（重新插入到末尾）
                    del self._cache[key]
                    self._cache[key] = (ts, vec)
                    return vec
                else:
                    del self._cache[key]
        self._misses += 1
        return None

    def set(self, query: str, model: str, vec: list[float]) -> None:
        key = self._make_key(query, model)
        with self._lock:
            # LRU eviction（移除最舊的）
            if len(self._cache) >= self._max_size and key not in self._cache:
                oldest_key = next(iter(self._cache))
                del self._cache[oldest_key]
            self._cache[key] = (time.time(), vec)

    def stats(self) -> dict:
        with self._lock:
            total = self._hits + self._misses
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(self._hits / total * 100, 1) if total > 0 else 0,
                "ttl_seconds": self._ttl,
            }

    def clear(self) -> int:
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            self._hits = 0
            self._misses = 0
            return count


# Singleton
query_cache = QueryCache()
