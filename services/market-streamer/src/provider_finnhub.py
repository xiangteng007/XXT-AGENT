"""
Finnhub WebSocket provider for real-time market data.

Finnhub WebSocket:
  wss://ws.finnhub.io?token=<API_KEY>

Message format:
  {"type":"trade","data":[{"p":<price>,"s":"AAPL","t":<unix_ms>,"v":<volume>}, ...]}
"""
from __future__ import annotations

import aiohttp
import json
from datetime import datetime, timezone
from typing import AsyncIterator

from .models import QuoteTradeEvent, Instrument


class FinnhubWS:
    """
    Finnhub WebSocket feed client.
    
    Yields normalized QuoteTradeEvent objects for each trade.
    """

    def __init__(self, api_key: str, symbols: list[str], ping_interval_sec: float = 20.0):
        self.api_key = api_key
        self.symbols = symbols
        self.ping_interval_sec = ping_interval_sec

    def ws_url(self) -> str:
        """Build WebSocket URL with API key."""
        return f"wss://ws.finnhub.io?token={self.api_key}"

    async def connect_and_stream(self) -> AsyncIterator[QuoteTradeEvent]:
        """
        Connect to Finnhub WebSocket and yield trade events.
        
        Raises on connection errors for retry handling in main loop.
        """
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(
                self.ws_url(), 
                heartbeat=self.ping_interval_sec
            ) as ws:
                # Subscribe to all symbols
                for sym in self.symbols:
                    await ws.send_str(json.dumps({"type": "subscribe", "symbol": sym}))

                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        try:
                            payload = json.loads(msg.data)
                        except json.JSONDecodeError:
                            continue

                        # Only process trade messages
                        if payload.get("type") != "trade":
                            continue

                        data_list = payload.get("data") or []
                        for item in data_list:
                            symbol = str(item.get("s", "")).strip()
                            if not symbol:
                                continue

                            event = QuoteTradeEvent(
                                ingested_at=datetime.now(timezone.utc),
                                ts_ms=int(item.get("t", 0)),
                                instrument=Instrument(symbol=symbol, asset_class="STOCK"),
                                price=float(item.get("p", 0.0)),
                                volume=float(item.get("v", 0.0)),
                            )
                            yield event

                    elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                        break
