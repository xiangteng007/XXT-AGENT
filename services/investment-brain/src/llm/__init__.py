"""
LLM Provider abstraction layer.

Local-First strategy:
  1. Ollama (qwen3:14b) — Primary, local GPU
  2. AI Gateway (Cloud Run) — Fallback
  3. Google Gemini API — Emergency
"""

from .provider import LLMProvider, ProviderHealth
from .factory import get_llm_provider, get_fast_llm_provider

__all__ = [
    "LLMProvider",
    "ProviderHealth",
    "get_llm_provider",
    "get_fast_llm_provider",
]
