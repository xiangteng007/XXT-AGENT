"""
Push notification clients for Telegram and LINE.
"""
from __future__ import annotations
import aiohttp
import logging

logger = logging.getLogger("alert-engine.notifiers")


async def send_telegram(token: str, chat_id: str, text: str) -> bool:
    """
    Send a message via Telegram Bot API.
    
    Returns True if successful, False otherwise.
    """
    if not token or not chat_id:
        logger.debug("Telegram not configured, skipping")
        return False
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id, 
        "text": text, 
        "disable_web_page_preview": True,
        "parse_mode": "HTML"
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=10) as resp:
                if resp.status == 200:
                    logger.info(f"Telegram message sent to {chat_id}")
                    return True
                else:
                    body = await resp.text()
                    logger.error(f"Telegram API error {resp.status}: {body}")
                    return False
    except Exception as e:
        logger.error(f"Telegram send failed: {e}")
        return False


async def send_line(channel_token: str, to: str, text: str) -> bool:
    """
    Send a push message via LINE Messaging API.
    
    Returns True if successful, False otherwise.
    """
    if not channel_token or not to:
        logger.debug("LINE not configured, skipping")
        return False
    
    url = "https://api.line.me/v2/bot/message/push"
    headers = {"Authorization": f"Bearer {channel_token}"}
    payload = {
        "to": to, 
        "messages": [{"type": "text", "text": text}]
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    logger.info(f"LINE message sent to {to}")
                    return True
                else:
                    body = await resp.text()
                    logger.error(f"LINE API error {resp.status}: {body}")
                    return False
    except Exception as e:
        logger.error(f"LINE send failed: {e}")
        return False
