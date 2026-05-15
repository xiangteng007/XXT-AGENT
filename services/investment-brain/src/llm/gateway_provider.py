"""
AI Gateway LLM Provider — wraps the existing AIGatewayClient as a fallback.

Used when Ollama is unavailable. Routes through the Cloud Run ai-gateway service
which supports Gemini, GPT, and Claude.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx
import orjson

from .provider import LLMProvider, ProviderHealth

logger = logging.getLogger("investment-brain.llm.gateway")

GATEWAY_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


def _clean_json(text: str) -> str:
    """Strip markdown fences and whitespace from JSON response."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[-1].strip() == "```":
            cleaned = "\n".join(lines[1:-1])
        else:
            cleaned = "\n".join(lines[1:])
    return cleaned.strip()


class GatewayProvider(LLMProvider):
    """AI Gateway (Cloud Run) provider — fallback for when Ollama is offline."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str = "",
    ):
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._client: httpx.AsyncClient | None = None
        self._model = "ai-gateway"  # Actual model is determined by gateway

    @property
    def name(self) -> str:
        return "ai-gateway"

    @property
    def model(self) -> str:
        return self._model

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers: dict[str, str] = {"Content-Type": "application/json"}
            if self._api_key:
                headers["X-Api-Key"] = self._api_key
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                headers=headers,
                timeout=GATEWAY_TIMEOUT,
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
        payload: dict[str, Any] = {"message": prompt}
        if system_prompt:
            payload["systemPrompt"] = system_prompt

        resp = await client.post("/ai/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("reply", "")

    async def generate_structured(
        self,
        prompt: str,
        system_prompt: str,
        *,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> dict:
        reply = await self.chat(
            prompt=prompt,
            system_prompt=system_prompt + "\n\n只回應 JSON，不要其他文字。",
            temperature=temperature,
        )
        cleaned = _clean_json(reply)
        try:
            return orjson.loads(cleaned.encode())
        except Exception:
            logger.warning(f"[Gateway] JSON parse failed: {cleaned[:200]}")
            return {"raw_response": reply, "parse_error": True}

    async def health(self) -> ProviderHealth:
        try:
            start = time.monotonic()
            client = await self._get_client()
            resp = await client.get("/health")
            latency = (time.monotonic() - start) * 1000

            if resp.status_code == 200:
                return ProviderHealth(
                    name=self.name,
                    available=True,
                    model=self._model,
                    latency_ms=round(latency, 1),
                    metadata={"base_url": self._base_url},
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
