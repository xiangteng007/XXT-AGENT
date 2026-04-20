"""
Investment Brain API client (via OpenClaw Gateway).
"""
from __future__ import annotations
import aiohttp
import logging

logger = logging.getLogger("telegram-command-bot.investment_brain_client")


async def analyze_via_gateway(gateway_url: str, internal_secret: str, symbol: str, timeframe: str = "15m") -> dict:
    """
    Call OpenClaw Gateway /invest/analyze endpoint.
    
    Returns the full response JSON or error dict.
    """
    if not gateway_url:
        return {"ok": False, "error": "OPENCLAW_GATEWAY_URL not configured"}
    
    url = f"{gateway_url}/invest/analyze"
    payload = {
        "symbol": symbol,
        "timeframe": timeframe,
        "risk_level": "moderate"
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    if internal_secret:
        headers["X-Internal-Secret"] = internal_secret
    
    try:
        async with aiohttp.ClientSession() as session:
            # LangGraph pipeline can take a while (e.g., 60-90s)
            async with session.post(url, json=payload, headers=headers, timeout=90) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    err_txt = await resp.text()
                    return {"ok": False, "error": f"HTTP {resp.status}: {err_txt}"}
    except Exception as e:
        logger.error(f"Investment Brain call failed: {e}")
        return {"ok": False, "error": str(e)}
