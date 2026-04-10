"""
Tools — AI Gateway Client

Unified interface for calling the XXT-AGENT AI Gateway.
Supports Gemini, GPT, and Claude through the existing multi-provider gateway.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
import orjson

from ..config import settings

logger = logging.getLogger("investment-brain.tools.ai_gateway")

# Timeout for AI calls (LLM can be slow)
AI_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class AIGatewayClient:
    """Client for the XXT-AGENT AI Gateway service."""

    def __init__(self, base_url: str | None = None, api_key: str | None = None):
        self.base_url = (base_url or settings.ai_gateway_url).rstrip("/")
        self.api_key = api_key or settings.ai_gateway_api_key
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers: dict[str, str] = {"Content-Type": "application/json"}
            if self.api_key:
                headers["X-Api-Key"] = self.api_key
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=headers,
                timeout=AI_TIMEOUT,
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def chat(
        self,
        message: str,
        system_prompt: str | None = None,
        context: str | None = None,
        model: str | None = None,
    ) -> str:
        """Send a chat message to AI Gateway and return the reply."""
        client = await self._get_client()
        payload: dict[str, Any] = {"message": message}
        if system_prompt:
            payload["systemPrompt"] = system_prompt
        if context:
            payload["context"] = context
        if model:
            payload["model"] = model

        resp = await client.post("/ai/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("reply", "")

    async def analyze_sentiment(
        self, text: str, context: str | None = None, model: str | None = None
    ) -> dict:
        """Analyze sentiment of text."""
        client = await self._get_client()
        payload: dict[str, Any] = {"text": text}
        if context:
            payload["context"] = context
        if model:
            payload["model"] = model

        resp = await client.post("/ai/sentiment", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def assess_impact(
        self,
        title: str,
        content: str | None = None,
        symbols: list[str] | None = None,
        model: str | None = None,
    ) -> dict:
        """Assess market impact of news/event."""
        client = await self._get_client()
        payload: dict[str, Any] = {"title": title}
        if content:
            payload["content"] = content
        if symbols:
            payload["symbols"] = symbols
        if model:
            payload["model"] = model

        resp = await client.post("/ai/impact", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def generate_structured(
        self,
        prompt: str,
        system_prompt: str,
        model: str | None = None,
    ) -> dict:
        """Generate structured JSON response via chat endpoint."""
        reply = await self.chat(
            message=prompt,
            system_prompt=system_prompt + "\n\n只回應 JSON，不要其他文字。",
            model=model,
        )
        # Parse JSON from response (strip markdown fences if present)
        cleaned = reply.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            # Remove first and last lines (fences)
            cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            return orjson.loads(cleaned.encode())
        except Exception:
            logger.warning(f"Failed to parse AI response as JSON: {cleaned[:200]}")
            return {"raw_response": reply, "parse_error": True}


# Singleton
ai_gateway = AIGatewayClient()
