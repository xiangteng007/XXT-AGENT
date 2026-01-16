"""
Trade Planner Worker API client.
"""
from __future__ import annotations
import aiohttp
import logging

logger = logging.getLogger("telegram-command-bot.planner_client")


async def analyze(planner_url: str, symbol: str, timeframe: str = "15m") -> dict:
    """
    Call trade-planner-worker /analyze endpoint.
    
    Returns the full response JSON or error dict.
    """
    if not planner_url:
        return {"ok": False, "error": "TRADE_PLANNER_URL not configured"}
    
    url = f"{planner_url}/analyze"
    payload = {"symbol": symbol, "timeframe": timeframe}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=30) as resp:
                return await resp.json()
    except Exception as e:
        logger.error(f"Trade planner call failed: {e}")
        return {"ok": False, "error": str(e)}
