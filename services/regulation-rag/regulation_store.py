"""
Regulation Store — 純 Python/numpy 向量搜尋實作
無需 C++ 編譯器，相容 Python 3.13+

設計：
  - 使用 numpy 計算餘弦相似度（效能足夠用於 <10萬 chunks）
  - 資料以 JSON + .npy 格式持久化到磁碟
  - 支援 category 過濾
  - 若 numpy 不可用，降級到線性點積搜尋

與 Chroma 相容的相同 API，方便未來升級
"""

import json
import os
import math
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, asdict


@dataclass
class ChunkResult:
    content: str
    source: str
    category: str
    score: float
    knowledge_date: str


class RegulationStore:
    """
    純 Python 向量資料庫

    儲存格式（data/vector_db/）：
      metadata.json   - 所有 chunk 的 id/content/metadata
      vectors.json    - 所有 embedding 向量（list of list）
    """

    def __init__(self, chroma_path: str = "./data/chroma_db"):
        # 相容 chroma_path 參數名，但實際存在 vector_db/
        self.db_dir = Path(chroma_path).parent / "vector_db"
        self.db_dir.mkdir(parents=True, exist_ok=True)

        self.meta_file = self.db_dir / "metadata.json"
        self.vec_file  = self.db_dir / "vectors.json"

        self._load()

    def _load(self):
        """從磁碟載入資料"""
        if self.meta_file.exists():
            with open(self.meta_file, encoding="utf-8") as f:
                self._metadata: list[dict] = json.load(f)
        else:
            self._metadata = []

        if self.vec_file.exists():
            with open(self.vec_file, encoding="utf-8") as f:
                self._vectors: list[list[float]] = json.load(f)
        else:
            self._vectors = []

    def _save(self):
        """持久化到磁碟"""
        with open(self.meta_file, "w", encoding="utf-8") as f:
            json.dump(self._metadata, f, ensure_ascii=False, indent=2)
        with open(self.vec_file, "w", encoding="utf-8") as f:
            json.dump(self._vectors, f)

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """計算兩個向量的餘弦相似度"""
        try:
            import numpy as np
            na, nb = np.array(a), np.array(b)
            denom = np.linalg.norm(na) * np.linalg.norm(nb)
            if denom == 0:
                return 0.0
            return float(np.dot(na, nb) / denom)
        except ImportError:
            # numpy 不可用，純 Python fallback
            dot = sum(x * y for x, y in zip(a, b))
            norm_a = math.sqrt(sum(x * x for x in a))
            norm_b = math.sqrt(sum(x * x for x in b))
            if norm_a == 0 or norm_b == 0:
                return 0.0
            return dot / (norm_a * norm_b)

    def total_chunks(self, category: Optional[str] = None) -> int:
        if category:
            return sum(1 for m in self._metadata if m.get("category") == category)
        return len(self._metadata)

    def list_categories(self) -> list[str]:
        return sorted(set(m.get("category", "unknown") for m in self._metadata))

    def list_sources(self, category: Optional[str] = None) -> list[dict]:
        seen = set()
        sources = []
        for m in self._metadata:
            if category and m.get("category") != category:
                continue
            key = m.get("source_doc", "")
            if key not in seen:
                seen.add(key)
                sources.append({
                    "source": key,
                    "category": m.get("category", ""),
                    "knowledge_date": m.get("knowledge_date", ""),
                })
        return sources

    def search(
        self,
        query_vec: list[float],
        category: Optional[str] = None,
        top_k: int = 5,
    ) -> list[ChunkResult]:
        """向量相似度搜尋"""
        if not self._vectors:
            return []

        scores: list[tuple[int, float]] = []
        for i, (meta, vec) in enumerate(zip(self._metadata, self._vectors)):
            if category and meta.get("category") != category:
                continue
            sim = self._cosine_similarity(query_vec, vec)
            scores.append((i, sim))

        # 按相似度排序，取前 top_k
        scores.sort(key=lambda x: x[1], reverse=True)
        top = scores[:top_k]

        results = []
        for idx, score in top:
            m = self._metadata[idx]
            results.append(ChunkResult(
                content=m.get("content", ""),
                source=m.get("source", "未知法規"),
                category=m.get("category", ""),
                score=round(score, 4),
                knowledge_date=m.get("knowledge_date", ""),
            ))
        return results

    def upsert_chunks(self, chunks: list[dict]) -> int:
        """批次寫入/更新 chunks"""
        if not chunks:
            return 0

        # 建立 ID → index 的查找表
        id_to_idx = {m["id"]: i for i, m in enumerate(self._metadata)}

        for chunk in chunks:
            cid = chunk["id"]
            meta_entry = {
                "id": cid,
                "content": chunk["content"],
                **chunk["metadata"],
            }
            vec = chunk["embedding"]

            if cid in id_to_idx:
                # 更新
                idx = id_to_idx[cid]
                self._metadata[idx] = meta_entry
                self._vectors[idx] = vec
            else:
                # 新增
                id_to_idx[cid] = len(self._metadata)
                self._metadata.append(meta_entry)
                self._vectors.append(vec)

        self._save()
        return len(chunks)

    def delete_by_source(self, source_doc: str) -> int:
        """刪除指定文件的所有 chunks"""
        keep_meta = []
        keep_vecs = []
        deleted = 0
        for m, v in zip(self._metadata, self._vectors):
            if m.get("source_doc") == source_doc:
                deleted += 1
            else:
                keep_meta.append(m)
                keep_vecs.append(v)
        self._metadata = keep_meta
        self._vectors = keep_vecs
        if deleted:
            self._save()
        return deleted
