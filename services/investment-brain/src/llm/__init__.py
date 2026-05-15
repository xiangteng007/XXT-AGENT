"""
LLM Provider abstraction layer.

Local-First strategy:
  1. Ollama (qwen3:14b) — Primary, local GPU
  2. AI Gateway (Cloud Run) — Fallback
  3. Google Gemini API — Emergency
"""

from .provider import LLMProvider, ProviderHealth
from .factory import get_llm_provider, get_fast_llm_provider
from .parser import (
    parse_structured_response,
    extract_json,
    parse_market_insight,
    parse_verification,
    parse_investment_plan,
    parse_evaluation,
    parse_quick_analysis,
    parse_market_outlook,
    parse_sentiment,
)

__all__ = [
    "LLMProvider",
    "ProviderHealth",
    "get_llm_provider",
    "get_fast_llm_provider",
    "parse_structured_response",
    "extract_json",
    "parse_market_insight",
    "parse_verification",
    "parse_investment_plan",
    "parse_evaluation",
    "parse_quick_analysis",
    "parse_market_outlook",
    "parse_sentiment",
]
