"""
LLM Provider Factory — Local-First with automatic fallback.

Boot sequence:
  1. Probe Ollama → available? Lock as primary.
  2. Ollama offline → probe AI Gateway → lock as fallback.
  3. Both down → log critical warning, return Gateway (will fail at call time).

Two provider tiers:
  - Primary   (qwen3:14b) — deep reasoning nodes
  - Fast      (qwen3:8b)  — lightweight checks (risk_manager, evaluator)
"""
from __future__ import annotations

import logging

from ..config import settings
from .provider import LLMProvider
from .ollama_provider import OllamaProvider
from .gateway_provider import GatewayProvider

logger = logging.getLogger("investment-brain.llm.factory")

# ── Module-level singletons ────────────────────────────────
_primary_provider: LLMProvider | None = None
_fast_provider: LLMProvider | None = None
_initialized = False


async def _probe_ollama(base_url: str, model: str) -> bool:
    """Check if Ollama is reachable and has the required model."""
    provider = OllamaProvider(base_url=base_url, model_name=model)
    try:
        health = await provider.health()
        if health.available:
            models = health.metadata.get("models", [])
            # Check if the target model is available (partial match on name)
            model_base = model.split(":")[0]
            has_model = any(model_base in m for m in models)
            if has_model:
                logger.info(f"[Factory] Ollama probe OK: {model} available at {base_url}")
                return True
            else:
                logger.warning(
                    f"[Factory] Ollama reachable but model '{model}' not found. "
                    f"Available: {models}"
                )
                return False
        return False
    except Exception as e:
        logger.warning(f"[Factory] Ollama probe failed: {e}")
        return False
    finally:
        await provider.close()


async def initialize() -> None:
    """
    Initialize LLM providers with Local-First strategy.
    
    Call this once during application startup (lifespan).
    """
    global _primary_provider, _fast_provider, _initialized

    if _initialized:
        return

    ollama_url = settings.ollama_base_url
    primary_model = settings.ollama_model
    fast_model = settings.ollama_fast_model

    # ── 1. Probe Ollama for primary model ──────────────────
    primary_ollama_ok = await _probe_ollama(ollama_url, primary_model)

    if primary_ollama_ok:
        _primary_provider = OllamaProvider(
            base_url=ollama_url,
            model_name=primary_model,
        )
        logger.info(f"[Factory] 🥇 Primary LLM: Ollama/{primary_model}")
    else:
        _primary_provider = GatewayProvider(
            base_url=settings.ai_gateway_url,
            api_key=settings.ai_gateway_api_key,
        )
        logger.warning(f"[Factory] 🥈 Primary LLM: AI Gateway (Ollama unavailable)")

    # ── 2. Probe Ollama for fast model ─────────────────────
    if primary_ollama_ok:
        # If primary works, fast model is likely on the same Ollama
        fast_ollama_ok = await _probe_ollama(ollama_url, fast_model)
        if fast_ollama_ok:
            _fast_provider = OllamaProvider(
                base_url=ollama_url,
                model_name=fast_model,
            )
            logger.info(f"[Factory] 🥇 Fast LLM: Ollama/{fast_model}")
        else:
            # Fall back to primary model for fast tasks
            _fast_provider = _primary_provider
            logger.info(f"[Factory] Fast LLM: using primary provider (fast model unavailable)")
    else:
        _fast_provider = _primary_provider
        logger.info(f"[Factory] Fast LLM: same as primary (Gateway)")

    _initialized = True

    # Log summary
    logger.info(
        f"[Factory] LLM ready — "
        f"primary={_primary_provider.name}/{_primary_provider.model}, "
        f"fast={_fast_provider.name}/{_fast_provider.model}"
    )


def get_llm_provider() -> LLMProvider:
    """Get the primary LLM provider (deep reasoning, e.g. qwen3:14b)."""
    if _primary_provider is None:
        # Fallback: create a gateway provider if not initialized
        logger.warning("[Factory] Provider not initialized, creating Gateway fallback")
        return GatewayProvider(
            base_url=settings.ai_gateway_url,
            api_key=settings.ai_gateway_api_key,
        )
    return _primary_provider


def get_fast_llm_provider() -> LLMProvider:
    """Get the fast LLM provider (lightweight tasks, e.g. qwen3:8b)."""
    if _fast_provider is None:
        return get_llm_provider()
    return _fast_provider


async def shutdown() -> None:
    """Cleanup all providers. Call during application shutdown."""
    global _primary_provider, _fast_provider, _initialized
    if _primary_provider:
        await _primary_provider.close()
    if _fast_provider and _fast_provider is not _primary_provider:
        await _fast_provider.close()
    _primary_provider = None
    _fast_provider = None
    _initialized = False
