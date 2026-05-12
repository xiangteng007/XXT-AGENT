"""
Cloud Embedding — Google Gemini text-embedding-004

取代 Ollama 本地 embedding，用於 Cloud Run 部署環境
支援 768 維度向量（與 nomic-embed-text 相同維度）

環境變數：
  GEMINI_API_KEY: Google Generative AI API Key (Secret Manager)
  GCP_PROJECT_ID: 若使用 Vertex AI 而非 Generative AI
"""

import os
from typing import Optional

# 延遲導入，避免未安裝 google-generativeai 時 crash
_genai = None

def _get_genai():
    global _genai
    if _genai is None:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
        _genai = genai
    return _genai


async def get_cloud_embedding(
    text: str,
    model: str = "text-embedding-004",
    dimensions: int = 768,
) -> list[float]:
    """
    使用 Google Gemini text-embedding-004 取得向量

    text-embedding-004 特性：
    - 最大 2048 tokens
    - 支援自訂維度 (256, 768, etc.)
    - 中文語義效能佳
    - 768 維度與 nomic-embed-text 相容

    Raises:
        RuntimeError: API Key 未設定或 API 呼叫失敗
    """
    genai = _get_genai()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set — cannot use cloud embedding")

    try:
        result = genai.embed_content(
            model=f"models/{model}",
            content=text,
            output_dimensionality=dimensions,
        )
        embedding = result["embedding"]
        if not embedding:
            raise RuntimeError(f"Empty embedding from {model}")
        return embedding
    except Exception as e:
        raise RuntimeError(f"Cloud embedding failed: {e}")


async def ping_cloud_embed() -> bool:
    """快速檢查 Cloud Embedding 是否可用"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return False
    try:
        vec = await get_cloud_embedding("test", dimensions=768)
        return len(vec) == 768
    except Exception:
        return False
