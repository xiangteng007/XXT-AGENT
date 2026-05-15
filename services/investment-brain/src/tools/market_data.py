"""
Tools — Market Data Client

Multi-source market data with intelligent routing:
  1. Fugle API (台股 — TW suffix symbols) — Primary for Taiwan stocks
  2. Yahoo Finance (US / international) — Primary for non-TW stocks
  3. Cross-fallback: If primary fails, try the other source

Supports real-time quotes, historical candles, and technical indicators.
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timedelta
from typing import Any

import httpx

logger = logging.getLogger("investment-brain.tools.market_data")

MARKET_DATA_TIMEOUT = httpx.Timeout(15.0, connect=5.0)

# ── Fugle API (台股) ──────────────────────────────────────────
FUGLE_API_KEY = os.getenv("FUGLE_API_KEY", "")
FUGLE_BASE_URL = "https://api.fugle.tw/marketdata/v1.0"

# ── Yahoo Finance API ─────────────────────────────────────────
YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"

# Pattern: Taiwan stock codes (e.g., 2330.TW, 2330, 00940.TW)
TW_STOCK_PATTERN = re.compile(r"^\d{4,6}(\.TW)?$", re.IGNORECASE)


def _is_tw_stock(symbol: str) -> bool:
    """Detect if symbol is a Taiwan stock."""
    return bool(TW_STOCK_PATTERN.match(symbol.strip()))


def _normalize_tw_symbol(symbol: str) -> str:
    """Normalize TW symbol — strip .TW suffix for Fugle API."""
    return symbol.upper().replace(".TW", "").strip()


class MarketDataClient:
    """Multi-source market data client with intelligent routing."""

    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=MARKET_DATA_TIMEOUT,
                headers={"User-Agent": "XXT-Agent/1.0"},
            )
        return self._client

    # ═══════════════════════════════════════════════════════════
    # PUBLIC API
    # ═══════════════════════════════════════════════════════════

    async def get_candles(
        self,
        symbol: str,
        interval: str = "1d",
        range_str: str = "1mo",
        start: str | None = None,
        end: str | None = None,
    ) -> list[dict]:
        """
        Fetch OHLCV candle data with intelligent source routing.

        Args:
            symbol: Stock symbol (e.g., 2330.TW, AAPL, TSLA)
            interval: Candle interval (1m, 5m, 15m, 1h, 1d)
            range_str: Time range for Yahoo (1d, 5d, 1mo, 3mo, 6mo, 1y)
            start: Start date YYYY-MM-DD (for Fugle historical)
            end: End date YYYY-MM-DD (for Fugle historical)
        """
        if _is_tw_stock(symbol) and FUGLE_API_KEY:
            candles = await self._fugle_candles(symbol, start, end)
            if candles:
                return candles
            logger.info(f"[MarketData] Fugle failed for {symbol}, falling back to Yahoo")

        candles = await self._yahoo_candles(symbol, interval, range_str)
        if candles:
            return candles

        # Last resort: try Fugle even for non-TW if Yahoo failed
        if FUGLE_API_KEY and not _is_tw_stock(symbol):
            return await self._fugle_candles(symbol, start, end)
        return []

    async def get_quote(self, symbol: str) -> dict | None:
        """Get current quote with source routing."""
        if _is_tw_stock(symbol) and FUGLE_API_KEY:
            quote = await self._fugle_quote(symbol)
            if quote:
                return quote
            logger.info(f"[MarketData] Fugle quote failed for {symbol}, falling back to Yahoo")

        return await self._yahoo_quote(symbol)

    async def get_data_source_info(self) -> dict:
        """Return info about available data sources for health check."""
        return {
            "fugle": {
                "available": bool(FUGLE_API_KEY),
                "base_url": FUGLE_BASE_URL,
            },
            "yahoo": {
                "available": True,
                "base_url": YAHOO_BASE,
            },
        }

    # ═══════════════════════════════════════════════════════════
    # FUGLE (台股)
    # ═══════════════════════════════════════════════════════════

    async def _fugle_quote(self, symbol: str) -> dict | None:
        """Fetch real-time quote from Fugle API."""
        raw_symbol = _normalize_tw_symbol(symbol)
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{FUGLE_BASE_URL}/stock/intraday/quote/{raw_symbol}",
                headers={"X-API-KEY": FUGLE_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()

            # Normalize to unified quote format
            return {
                "symbol": symbol.upper(),
                "price": data.get("lastPrice") or data.get("closePrice", 0),
                "open": data.get("openPrice", 0),
                "high": data.get("highPrice", 0),
                "low": data.get("lowPrice", 0),
                "volume": data.get("totalVolume", 0),
                "change_pct": data.get("changePercent", 0),
                "timestamp": data.get("lastUpdated", datetime.utcnow().isoformat()),
                "source": "fugle",
                "is_mock": False,
            }
        except Exception as e:
            logger.warning(f"[Fugle] Quote failed for {raw_symbol}: {e}")
            return None

    async def _fugle_candles(
        self, symbol: str, start: str | None = None, end: str | None = None
    ) -> list[dict]:
        """Fetch historical candles from Fugle API."""
        raw_symbol = _normalize_tw_symbol(symbol)
        client = await self._get_client()

        # Default range: last 30 days
        if not end:
            end = datetime.utcnow().strftime("%Y-%m-%d")
        if not start:
            start = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")

        try:
            resp = await client.get(
                f"{FUGLE_BASE_URL}/stock/historical/candles/{raw_symbol}",
                params={"from": start, "to": end},
                headers={"X-API-KEY": FUGLE_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()

            raw_candles = data.get("data", [])
            candles = []
            for c in raw_candles:
                candles.append({
                    "timestamp": c.get("date", ""),
                    "datetime": c.get("date", ""),
                    "open": c.get("open", 0),
                    "high": c.get("high", 0),
                    "low": c.get("low", 0),
                    "close": c.get("close", 0),
                    "volume": c.get("volume", 0),
                    "source": "fugle",
                })
            return candles
        except Exception as e:
            logger.warning(f"[Fugle] Candles failed for {raw_symbol}: {e}")
            return []

    # ═══════════════════════════════════════════════════════════
    # YAHOO FINANCE (US / International)
    # ═══════════════════════════════════════════════════════════

    async def _yahoo_quote(self, symbol: str) -> dict | None:
        """Get current quote via Yahoo Finance."""
        candles = await self._yahoo_candles(symbol, interval="1m", range_str="1d")
        if not candles:
            return None

        latest = candles[-1]
        first = candles[0]

        change_pct = 0.0
        if first["open"] > 0:
            change_pct = ((latest["close"] - first["open"]) / first["open"]) * 100

        return {
            "symbol": symbol.upper(),
            "price": latest["close"],
            "open": first["open"],
            "high": max(c["high"] for c in candles),
            "low": min(c["low"] for c in candles),
            "volume": sum(c["volume"] for c in candles),
            "change_pct": round(change_pct, 3),
            "timestamp": latest["datetime"],
            "source": "yahoo",
            "is_mock": False,
        }

    async def _yahoo_candles(
        self, symbol: str, interval: str = "1d", range_str: str = "1mo"
    ) -> list[dict]:
        """Fetch OHLCV candle data from Yahoo Finance."""
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
                        "source": "yahoo",
                    })

            return candles

        except Exception as e:
            logger.warning(f"[Yahoo] Candles failed for {symbol}: {e}")
            return []

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Singleton
market_data = MarketDataClient()
