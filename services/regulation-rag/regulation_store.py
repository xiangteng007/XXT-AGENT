"""
Regulation Store — Qdrant 向量搜尋實作
取代舊版 Python/numpy 實作，支援 GCP Cloud Run 部署
"""

import os
from typing import Optional
from dataclasses import dataclass
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue


@dataclass
class ChunkResult:
    content: str
    source: str
    category: str
    score: float
    knowledge_date: str
    # B-3: Versioning support
    version: int = 1
    effective_date: str = ""
    source_url: str = ""


class RegulationStore:
    """
    Qdrant 向量資料庫
    """

    def __init__(self, qdrant_url: Optional[str] = None, qdrant_path: str = "./data/qdrant_db"):
        self.collection_name = "regulations"
        
        # 連線設定：優先使用 url，若無則降級為本地資料夾
        if qdrant_url:
            self.client = QdrantClient(url=qdrant_url)
        else:
            os.makedirs(qdrant_path, exist_ok=True)
            self.client = QdrantClient(path=qdrant_path)

        self._ensure_collection()

    def _ensure_collection(self):
        """確認 Collection 存在，若無則建立 (Nomic embed text 為 768 維度)"""
        collections = [c.name for c in self.client.get_collections().collections]
        if self.collection_name not in collections:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=768, distance=Distance.COSINE),
            )

    def total_chunks(self, category: Optional[str] = None) -> int:
        if category:
            q_filter = Filter(must=[FieldCondition(key="category", match=MatchValue(value=category))])
            return self.client.count(collection_name=self.collection_name, count_filter=q_filter).count
        return self.client.count(collection_name=self.collection_name).count

    def list_categories(self) -> list[str]:
        # Qdrant 不支援原生的 DISTINCT 查詢，這裡用 scroll 取出有限數量的 metadata 來推導
        categories = set()
        records, _ = self.client.scroll(
            collection_name=self.collection_name,
            limit=10000,
            with_payload=["category"],
            with_vectors=False
        )
        for r in records:
            cat = r.payload.get("category")
            if cat:
                categories.add(cat)
        return sorted(categories)

    def list_sources(self, category: Optional[str] = None) -> list[dict]:
        q_filter = None
        if category:
            q_filter = Filter(must=[FieldCondition(key="category", match=MatchValue(value=category))])
            
        records, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=q_filter,
            limit=10000,
            with_payload=["source_doc", "category", "knowledge_date"],
            with_vectors=False
        )
        
        seen = set()
        sources = []
        for r in records:
            key = r.payload.get("source_doc")
            if key and key not in seen:
                seen.add(key)
                sources.append({
                    "source": key,
                    "category": r.payload.get("category", ""),
                    "knowledge_date": r.payload.get("knowledge_date", ""),
                })
        return sources

    def search(
        self,
        query_vec: list[float],
        category: Optional[str] = None,
        top_k: int = 5,
    ) -> list[ChunkResult]:
        """Qdrant 向量相似度搜尋"""
        q_filter = None
        if category:
            q_filter = Filter(must=[FieldCondition(key="category", match=MatchValue(value=category))])

        search_result = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vec,
            query_filter=q_filter,
            limit=top_k,
        )

        results = []
        for hit in search_result:
            results.append(ChunkResult(
                content=hit.payload.get("content", ""),
                source=hit.payload.get("source", "未知法規"),
                category=hit.payload.get("category", ""),
                score=round(hit.score, 4),
                knowledge_date=hit.payload.get("knowledge_date", ""),
                version=hit.payload.get("version", 1),
                effective_date=hit.payload.get("effective_date", ""),
                source_url=hit.payload.get("source_url", ""),
            ))
        return results

    def upsert_chunks(self, chunks: list[dict]) -> int:
        """批次寫入/更新 chunks 到 Qdrant"""
        if not chunks:
            return 0

        points = []
        for chunk in chunks:
            payload = {
                "content": chunk["content"],
                **chunk["metadata"],
            }
            points.append(
                PointStruct(
                    id=chunk["id"], # 目前 id 已被 ingest.py 改為合法 UUID str
                    vector=chunk["embedding"],
                    payload=payload
                )
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )
        return len(chunks)

    def delete_by_source(self, source_doc: str) -> int:
        """刪除指定文件的所有 chunks"""
        q_filter = Filter(must=[FieldCondition(key="source_doc", match=MatchValue(value=source_doc))])
        
        # 先計算將會刪除幾筆
        count = self.client.count(collection_name=self.collection_name, count_filter=q_filter).count
        
        if count > 0:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=q_filter
            )
            
        return count
