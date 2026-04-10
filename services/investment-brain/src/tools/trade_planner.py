"""
Tools — Trade Planner Client

Calls the existing Trade Planner Worker to generate trade plans,
reusing its SKILL contract and Gemini integration.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from ..config import settings

logger = logging.getLogger("investment-brain.tools.trade_planner")

TRADE_PLANNER_TIMEOUT = httpx.Timeout(30.0, connect=5.0)


class TradePlannerClient:
    """Client for the XXT-AGENT Trade Planner Worker service."""

    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.trade_planner_url).rstrip("/")
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=TRADE_PLANNER_TIMEOUT,
            )
        return self._client

    async def analyze(
        self,
        symbol: str,
        timeframe: str = "1h",
    ) -> dict:
        """
        Call the Trade Planner Worker /analyze endpoint.

        Returns the structured trade plan following the SKILL contract:
        - snapshot, catalysts, market_structure, scenarios, suggested_action, disclosures
        """
        client = await self._get_client()
        try:
            resp = await client.post(
                "/analyze",
                json={"symbol": symbol, "timeframe": timeframe},
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get("ok"):
                return data.get("result", {})
            else:
                logger.warning(f"Trade Planner returned error: {data.get('error')}")
                return {}

        except httpx.HTTPStatusError as e:
            logger.error(f"Trade Planner HTTP error: {e.response.status_code}")
            return {}
        except Exception as e:
            logger.warning(f"Trade Planner unavailable: {e}")
            return {}

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Singleton
trade_planner = TradePlannerClient()
