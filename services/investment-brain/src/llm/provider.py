"""
LLM Provider — Abstract Base Class

All LLM backends (Ollama, AI Gateway, Google Gemini) implement this interface.
Graph nodes call only these methods, never backend-specific APIs.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ProviderHealth:
    """Health status of an LLM provider."""
    name: str
    available: bool
    model: str = ""
    latency_ms: float = -1
    error: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


class LLMProvider(abc.ABC):
    """Abstract LLM provider interface."""

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Provider name for logging/metrics."""
        ...

    @property
    @abc.abstractmethod
    def model(self) -> str:
        """Current model identifier."""
        ...

    @abc.abstractmethod
    async def chat(
        self,
        prompt: str,
        system_prompt: str = "",
        *,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> str:
        """Send a chat message and return the text reply."""
        ...

    @abc.abstractmethod
    async def generate_structured(
        self,
        prompt: str,
        system_prompt: str,
        *,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> dict:
        """Generate structured JSON response. Returns parsed dict or {parse_error: True}."""
        ...

    @abc.abstractmethod
    async def health(self) -> ProviderHealth:
        """Check provider health and availability."""
        ...

    async def close(self) -> None:
        """Cleanup resources. Override if needed."""
        pass
