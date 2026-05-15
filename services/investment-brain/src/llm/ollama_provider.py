"""
Ollama LLM Provider — Local GPU inference via Ollama OpenAI-compatible API.

Uses /v1/chat/completions for maximum compatibility.
Supports structured JSON output via format="json" parameter.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx
import orjson

from .provider import LLMProvider, ProviderHealth

logger = logging.getLogger("investment-brain.llm.ollama")

# Ollama can be slow for first-token on large models
OLLAMA_TIMEOUT = httpx.Timeout(120.0, connect=10.0)


def _clean_json(text: str) -> str:
    """Strip markdown fences and whitespace from JSON response."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json) and last line (```)
        if lines[-1].strip() == "```":
            cleaned = "\n".join(lines[1:-1])
        else:
            cleaned = "\n".join(lines[1:])
    return cleaned.strip()


class OllamaProvider(LLMProvider):
    """Local Ollama inference provider."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model_name: str = "qwen3:14b",
    ):
        self._base_url = base_url.rstrip("/")
        self._model = model_name
        self._client: httpx.AsyncClient | None = None

    @property
    def name(self) -> str:
        return "ollama"

    @property
    def model(self) -> str:
        return self._model

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=OLLAMA_TIMEOUT,
            )
        return self._client

    async def chat(
        self,
        prompt: str,
        system_prompt: str = "",
        *,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> str:
        client = await self._get_client()
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        resp = await client.post("/v1/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()

        # OpenAI-compatible response format
        choices = data.get("choices", [])
        if choices:
            content = choices[0].get("message", {}).get("content", "")
            # qwen3 may wrap response in <think>...</think> tags — strip them
            if "</think>" in content:
                content = content.split("</think>")[-1].strip()
            return content
        return ""

    async def generate_structured(
        self,
        prompt: str,
        system_prompt: str,
        *,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> dict:
        """Generate structured JSON using Ollama's native JSON mode."""
        client = await self._get_client()
        messages: list[dict[str, str]] = []

        # Enforce JSON output in system prompt
        json_system = system_prompt + "\n\n只回應 JSON，不要其他文字。不要使用 markdown 格式。"
        messages.append({"role": "system", "content": json_system})
        messages.append({"role": "user", "content": prompt})

        # Use Ollama native /api/chat with format=json for reliable structured output
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "format": "json",
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
            "stream": False,
        }

        resp = await client.post("/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()

        content = data.get("message", {}).get("content", "")

        # Use centralized parser with 5-strategy extraction
        from .parser import extract_json

        result = extract_json(content)
        if result is not None:
            return result

        logger.warning(
            f"[Ollama] JSON parse failed for model={self._model}, "
            f"response preview: {content[:200]}"
        )
        # Retry once with explicit instruction
        try:
            retry_resp = await self.chat(
                f"以下文字請轉換為合法 JSON 格式，只輸出 JSON：\n\n{content}",
                system_prompt="你是 JSON 格式轉換器。只輸出合法 JSON。",
                temperature=0.0,
            )
            retry_result = extract_json(retry_resp)
            if retry_result is not None:
                return retry_result
        except Exception:
            pass
        return {"raw_response": content, "parse_error": True}

    async def health(self) -> ProviderHealth:
        try:
            start = time.monotonic()
            client = await self._get_client()
            resp = await client.get("/api/tags")
            latency = (time.monotonic() - start) * 1000

            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                return ProviderHealth(
                    name=self.name,
                    available=True,
                    model=self._model,
                    latency_ms=round(latency, 1),
                    metadata={"models": models, "base_url": self._base_url},
                )
            return ProviderHealth(
                name=self.name,
                available=False,
                error=f"HTTP {resp.status_code}",
            )
        except Exception as e:
            return ProviderHealth(
                name=self.name,
                available=False,
                error=str(e),
            )

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
