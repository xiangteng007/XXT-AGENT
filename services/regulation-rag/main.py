"""
Regulation RAG — FastAPI Query Service
NemoClaw Layer 4: 台灣法規本地知識庫

架最：
  PDF/HTML 法規文件
      ↓ ingest pipeline
  純 Python 向量資料庫（numpy 余弦相似度）
      ↓ 語義搜尋
  FastAPI :8092
      ↓
  SENTENG ERP BuildingCodeService / Telegram Bot

硬體：RTX 4080 SUPER（CUDA 8.9）+ qwen3:14b via Ollama
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
import time
import os
from typing import Optional
from ollama_embed import get_embedding, ping_ollama
from regulation_store import RegulationStore
from query_cache import query_cache

# ── P1: CORS 白名單（不再允許 *）─────────────────────────────
# 生產環境請設定 ALLOWED_ORIGINS 環境變數（逗號分隔）
# 例: ALLOWED_ORIGINS=http://openclaw-gateway:3100,https://xxt-agent-dashboard.vercel.app
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3100,http://openclaw-gateway:3100,https://xxt-agent-dashboard.vercel.app"
)
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ── 設定 ──────────────────────────────────────────────────────
QDRANT_URL     = os.getenv("QDRANT_URL")
QDRANT_PATH    = os.getenv("CHROMA_PATH", "./data/qdrant_db") # Fallback to local storage for backward compatibility
OLLAMA_BASE   = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL   = os.getenv("EMBED_MODEL", "nomic-embed-text")
TOP_K         = int(os.getenv("RAG_TOP_K", "5"))
PORT          = int(os.getenv("PORT", "8092"))

store: Optional[RegulationStore] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global store
    store = RegulationStore(qdrant_url=QDRANT_URL, qdrant_path=QDRANT_PATH)
    print(f"[RegRAG] Loaded {store.total_chunks()} chunks from Qdrant {'('+QDRANT_URL+')' if QDRANT_URL else 'local path'}")
    reachable = await ping_ollama(OLLAMA_BASE)
    print(f"[RegRAG] Ollama reachable: {reachable} ({OLLAMA_BASE})")
    # P1: 啟動時印出 CORS 白名單供稽核
    print(f"[RegRAG] CORS allowed origins: {ALLOWED_ORIGINS}")
    yield
    # Shutdown (nothing to clean up for pure Python store)

app = FastAPI(
    title="Regulation RAG API",
    description="台灣建築/消防/稅法法規本地語義搜尋",
    version="1.0.0",
    lifespan=lifespan,
)

# P1: 鎖定 CORS 白名單（不再允許 * ）
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=False,
)

# ── 型別 ──────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    query: str
    category: Optional[str] = None    # "building", "fire", "cns", "tax", "labor"
    top_k: Optional[int] = None

class Chunk(BaseModel):
    content: str
    source: str           # e.g. "建築技術規則 §73"
    category: str
    score: float          # 語義相似度 0-1
    knowledge_date: str   # 法規版本日期
    # B-3: Versioning
    version: int = 1
    effective_date: str = ""
    source_url: str = ""

class QueryResponse(BaseModel):
    query: str
    results: list[Chunk]
    total_chunks_searched: int
    latency_ms: float
    embed_model: str


# ── 端點 ──────────────────────────────────────────────────────
@app.get("/health")
async def health():
    global store
    chunk_count = store.total_chunks() if store else 0
    ollama_ok = await ping_ollama(OLLAMA_BASE)
    return {
        "status": "ok",
        "chunks": chunk_count,
        "ollama": ollama_ok,
        "embed_model": EMBED_MODEL,
        "qdrant_url": QDRANT_URL,
        "qdrant_path": QDRANT_PATH,
        "cache": query_cache.stats(),
    }


@app.post("/query", response_model=QueryResponse)
async def query_regulations(req: QueryRequest):
    """
    語義搜尋法規知識庫

    範例：
      {"query": "住宅建蔽率限制", "category": "building"}
      {"query": "消防設備設置規定", "category": "fire"}
      {"query": "統一發票申報期限", "category": "tax"}
    """
    global store
    if not store:
        raise HTTPException(503, "Regulation store not initialized")

    start = time.time()
    k = req.top_k or TOP_K

    # 取得 query embedding（優先使用快取）
    cached_vec = query_cache.get(req.query, EMBED_MODEL)
    if cached_vec:
        query_vec = cached_vec
    else:
        try:
            query_vec = await get_embedding(req.query, OLLAMA_BASE, EMBED_MODEL)
            query_cache.set(req.query, EMBED_MODEL, query_vec)
        except Exception as e:
            raise HTTPException(503, f"Embedding service unavailable: {e}")

    # 向量搜尋
    results = store.search(
        query_vec=query_vec,
        category=req.category,
        top_k=k,
    )

    latency_ms = round((time.time() - start) * 1000, 1)

    # ChunkResult dataclass → Chunk Pydantic model
    chunks: list[Chunk] = [
        Chunk(
            content=r.content,
            source=r.source,
            category=r.category,
            score=r.score,
            knowledge_date=r.knowledge_date,
            version=r.version,
            effective_date=r.effective_date,
            source_url=r.source_url,
        )
        for r in results
    ]

    return QueryResponse(
        query=req.query,
        results=chunks,
        total_chunks_searched=store.total_chunks(category=req.category),
        latency_ms=latency_ms,
        embed_model=EMBED_MODEL,
    )


@app.get("/categories")
async def list_categories():
    """列出知識庫中可用的法規分類"""
    global store
    if not store:
        return {"categories": []}
    return {"categories": store.list_categories()}


@app.get("/sources")
async def list_sources(category: Optional[str] = Query(None)):
    """列出已載入的法規文件來源"""
    global store
    if not store:
        return {"sources": []}
    return {"sources": store.list_sources(category=category)}


@app.get("/cache/stats")
async def cache_stats():
    """查詢快取統計"""
    return query_cache.stats()


@app.post("/cache/clear")
async def cache_clear():
    """清除所有快取（重新 ingest 後使用）"""
    count = query_cache.clear()
    return {"cleared": count, "message": f"Cleared {count} cached embeddings"}


# ── B-3: 法規版本管理 ────────────────────────────────────────

class VersionRequest(BaseModel):
    regulation_id: str
    category: str
    content: str
    version: int
    effective_date: str
    source_url: str = ""

@app.post("/regulation/version")
async def upsert_regulation_version(req: VersionRequest):
    """
    發布新版本法規 (B-3)。
    (模擬實作：透過 ingest webhook 或外部呼叫來觸發重構 index)
    """
    return {
        "status": "success",
        "regulation_id": req.regulation_id,
        "version": req.version,
        "message": "Regulation version received. Embedding background task will be triggered.",
    }

@app.get("/regulation/version/{regulation_id}/history")
async def get_regulation_history(regulation_id: str):
    """取得法條的變更歷史"""
    # 待實作：查詢 Qdrant 內相同 regulation_id 卻不同 version 的 Metadata
    return {
        "regulation_id": regulation_id,
        "history": [
            {"version": 1, "effective_date": "2023-01-01"},
            {"version": 2, "effective_date": "2024-07-01"}
        ]
    }

@app.get("/regulation/changelog")
async def get_changelog(since: str = "2026-01-01"):
    """取得特定日期之後的變更日誌"""
    return {
        "since": since,
        "changes": []
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
