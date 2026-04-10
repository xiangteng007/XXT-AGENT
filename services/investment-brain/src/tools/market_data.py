"""
Tools — Market Data Client

Fetches historical and real-time market data for analysis and backtesting.
Uses free data sources (Yahoo Finance API via httpx) as default.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import httpx

logger = logging.getLogger("investment-brain.tools.market_data")

MARKET_DATA_TIMEOUT = httpx.Timeout(15.0, connect=5.0)

# Yahoo Finance API (unofficial but widely used)
YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"


class MarketDataClient:
    """Client for fetching market data from public sources."""

    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=MARKET_DATA_TIMEOUT,
                headers={"User-Agent": "XXT-Agent/1.0"},
            )
        return self._client

    async def get_candles(
        self,
        symbol: str,
        interval: str = "1m",
        range_str: str = "1d",
    ) -> list[dict]:
        """
        Fetch OHLCV candle data.

        Args:
            symbol: Stock symbol (e.g., AAPL, TSLA)
            interval: Candle interval (1m, 5m, 15m, 1h, 1d)
            range_str: Time range (1d, 5d, 1mo, 3mo, 6mo, 1y)
        """
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{YAHOO_BASE}/{symbol}",
                params={
                    "interval": interval,
                    "range": range_str,
                    "includePrePost": "false",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            result = data.get("chart", {}).get("result", [])
            if not result:
                return []

            chart = result[0]
            timestamps = chart.get("timestamp", [])
            quote = chart.get("indicators", {}).get("quote", [{}])[0]

            candles = []
            for i, ts in enumerate(timestamps):
                o = quote.get("open", [None])[i]
                h = quote.get("high", [None])[i]
                lo = quote.get("low", [None])[i]
                c = quote.get("close", [None])[i]
                v = quote.get("volume", [0])[i]

                if o is not None and c is not None:
                    candles.append({
                        "timestamp": ts,
                        "datetime": datetime.utcfromtimestamp(ts).isoformat(),
                        "open": round(o, 4),
                        "high": round(h, 4),
                        "low": round(lo, 4),
                        "close": round(c, 4),
                        "volume": v or 0,
                    })

            return candles

        except Exception as e:
            logger.warning(f"Failed to fetch candles for {symbol}: {e}")
            return []

    async def get_quote(self, symbol: str) -> dict | None:
        """Get current quote for a symbol."""
        candles = await self.get_candles(symbol, interval="1m", range_str="1d")
        if not candles:
            return None

        latest = candles[-1]
        first = candles[0]

        change_pct = 0.0
        if first["open"] > 0:
            change_pct = ((latest["close"] - first["open"]) / first["open"]) * 100

        return {
            "symbol": symbol,
            "price": latest["close"],
            "open": first["open"],
            "high": max(c["high"] for c in candles),
            "low": min(c["low"] for c in candles),
            "volume": sum(c["volume"] for c in candles),
            "change_pct": round(change_pct, 3),
            "timestamp": latest["datetime"],
        }

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Singleton
market_data = MarketDataClient()
