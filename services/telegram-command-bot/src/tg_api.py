"""
Telegram Bot API client for sending messages.
"""
from __future__ import annotations
import aiohttp
import logging

logger = logging.getLogger("telegram-command-bot.tg_api")


async def send_message(token: str, chat_id: str, text: str, parse_mode: str = None) -> None:
    """
    Send a message via Telegram Bot API.
    """
    if not token or not chat_id:
        return
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id, 
        "text": text, 
        "disable_web_page_preview": True
    }
    
    if parse_mode:
        payload["parse_mode"] = parse_mode
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=10) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.warning(f"Telegram send failed {resp.status}: {body[:100]}")
    except Exception as e:
        logger.error(f"Telegram send error: {e}")
