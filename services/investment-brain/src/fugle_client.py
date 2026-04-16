from typing import Dict, Any, List, Optional
import os
import httpx

FUGLE_API_KEY = os.getenv("FUGLE_API_KEY", "")
FUGLE_BASE_URL = "https://api.fugle.tw/marketdata/v1.0"

class FugleClient:
    def __init__(self):
        if not FUGLE_API_KEY:
            print("[WARN] FUGLE_API_KEY not set. API calls will fail.")
        self.headers = {"X-API-KEY": FUGLE_API_KEY}

    async def get_realtime_quote(self, symbol: str) -> Dict[str, Any]:
        """Fetch real-time quote for a symbol."""
        url = f"{FUGLE_BASE_URL}/stock/intraday/quote/{symbol}"
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=self.headers)
            res.raise_for_status()
            return res.json()

    async def get_historical_candles(self, symbol: str, start: str, end: str) -> List[Dict[str, Any]]:
        """Fetch historical daily candles for a symbol. Format: YYYY-MM-DD"""
        url = f"{FUGLE_BASE_URL}/stock/historical/candles/{symbol}?from={start}&to={end}"
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=self.headers)
            res.raise_for_status()
            data = res.json()
            return data.get("data", [])
