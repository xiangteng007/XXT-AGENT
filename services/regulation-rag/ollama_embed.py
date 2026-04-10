"""
Ollama Embedding — 呼叫本地 Ollama 取得向量
使用 nomic-embed-text 模型（中文語義效能佳）
"""

import httpx
import asyncio
from typing import Optional


async def get_embedding(
    text: str,
    ollama_base: str = "http://localhost:11434",
    model: str = "nomic-embed-text",
) -> list[float]:
    """
    呼叫 Ollama /api/embed 取得文字向量

    Args:
        text: 要 embed 的文字
        ollama_base: Ollama API base URL
        model: embedding 模型名稱

    Returns:
        float list（embedding 向量）

    Raises:
        RuntimeError: Ollama 不可達或模型未安裝
    """
    url = f"{ollama_base}/api/embed"
    payload = {"model": model, "input": text}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            # Ollama /api/embed 回傳格式：
            # {"model":"...","embeddings":[[...]],"total_duration":...}
            embeddings = data.get("embeddings") or data.get("embedding")
            if not embeddings:
                raise RuntimeError(f"No embeddings in response: {data}")
            # 若回傳是 list of list，取第一個
            vec = embeddings[0] if isinstance(embeddings[0], list) else embeddings
            return vec
        except httpx.ConnectError:
            raise RuntimeError(f"Ollama unreachable at {ollama_base}")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Ollama embed error HTTP {e.response.status_code}: {e.response.text}")


async def ping_ollama(ollama_base: str = "http://localhost:11434") -> bool:
    """快速 ping Ollama，用於健康檢查"""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{ollama_base}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


def get_embedding_sync(
    text: str,
    ollama_base: str = "http://localhost:11434",
    model: str = "nomic-embed-text",
) -> list[float]:
    """同步版本（ingest pipeline 使用）"""
    return asyncio.run(get_embedding(text, ollama_base, model))
