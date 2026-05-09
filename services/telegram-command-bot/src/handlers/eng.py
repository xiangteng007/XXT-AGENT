"""
handlers/eng.py — Engineering Department handlers (v9.1)

Handles: /eng, /estimator, /interior, /scout
Delegates to OpenClaw Gateway agents: bim, estimator, interior, scout
"""
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..config import Settings

from ..tg_api import send_message
from .audit import emit_cmd_audit

logger = logging.getLogger("telegram-command-bot.eng")


async def _call_agent(
    gateway_url: str,
    internal_secret: str,
    bot_token: str,
    chat_id: int | str,
    agent_path: str,
    user_msg: str,
    reply_prefix: str,
) -> None:
    """Generic agent call with reply forwarding."""
    from aiohttp import ClientSession, ClientTimeout

    try:
        timeout = ClientTimeout(total=30)
        async with ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{gateway_url}{agent_path}",
                json={"message": user_msg},
                headers={"Authorization": f"Bearer {internal_secret}"},
            ) as resp:
                data = await resp.json()
                reply = data.get("reply") or data.get("content") or data.get("message", "")
                if reply:
                    await send_message(
                        bot_token, chat_id,
                        f"{reply_prefix}\n{reply}",
                        parse_mode="HTML",
                    )
                else:
                    await send_message(bot_token, chat_id, "⚠️ 代理無回應，請稍後再試。")
    except Exception as e:
        logger.error(f"[Eng] Agent call failed to {agent_path}: {e}")
        await send_message(bot_token, chat_id, f"❌ 連線失敗: {e}")


async def handle_eng(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
) -> None:
    """/eng <問題> — Titan & Rusty 工程管理"""
    if not args:
        await send_message(
            settings.telegram_bot_token, chat_id,
            "用法: /eng <問題>\n範例: /eng 台北工地進度如何？"
        )
        return

    user_msg = " ".join(args)
    await send_message(
        settings.telegram_bot_token, chat_id,
        "🏗️ <b>Titan &amp; Rusty (工程管理)</b>\n收到您的工程查詢請求，正在檢索 BIM 與估算資料...",
        parse_mode="HTML"
    )
    asyncio.create_task(
        _call_agent(
            settings.openclaw_gateway_url,
            settings.internal_secret,
            settings.telegram_bot_token,
            chat_id,
            "/agents/bim/chat",
            f"[工程管理查詢] {user_msg}",
            "🏗️ <b>Titan (BIM/工程管理) 回覆：</b>",
        )
    )


async def handle_estimator(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
) -> None:
    """/estimator <問題> — Rusty 估算與計價"""
    if not args:
        await send_message(
            settings.telegram_bot_token, chat_id,
            "用法: /estimator <問題>\n範例: /estimator 150坪辦公室裝修造價?"
        )
        return

    user_msg = " ".join(args)
    await send_message(
        settings.telegram_bot_token, chat_id,
        "🏗️ <b>Rusty (估算與計價)</b>\n收到您的估算請求，正在檢索數量與價格資料...",
        parse_mode="HTML"
    )
    asyncio.create_task(
        _call_agent(
            settings.openclaw_gateway_url,
            settings.internal_secret,
            settings.telegram_bot_token,
            chat_id,
            "/agents/estimator/chat",
            f"[估算與計價] {user_msg}",
            "🏗️ <b>Rusty (估算與計價) 回覆：</b>",
        )
    )


async def handle_interior(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
) -> None:
    """/interior <問題> — Lumi 室內設計"""
    if not args:
        await send_message(
            settings.telegram_bot_token, chat_id,
            "用法: /interior <問題>\n範例: /interior 推薦現代北歐風書房設計"
        )
        return

    user_msg = " ".join(args)
    await send_message(
        settings.telegram_bot_token, chat_id,
        "🏗️ <b>Lumi (室內設計)</b>\n收到您的設計查詢，正在為您提供裝潢建議...",
        parse_mode="HTML"
    )
    asyncio.create_task(
        _call_agent(
            settings.openclaw_gateway_url,
            settings.internal_secret,
            settings.telegram_bot_token,
            chat_id,
            "/agents/interior/chat",
            f"[室內設計與裝潢] {user_msg}",
            "🏗️ <b>Lumi (室內設計) 回覆：</b>",
        )
    )


async def handle_scout(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
) -> None:
    """/scout <指令> — Scout 無人機任務"""
    user_msg = " ".join(args) if args else "無人機任務查詢"
    await send_message(
        settings.telegram_bot_token, chat_id,
        "🚁 <b>Scout (無人機任務)</b>\n收到任務指令，正在調度無人機系統...",
        parse_mode="HTML"
    )
    asyncio.create_task(
        _call_agent(
            settings.openclaw_gateway_url,
            settings.internal_secret,
            settings.telegram_bot_token,
            chat_id,
            "/agents/scout/chat",
            f"[無人機任務] {user_msg}",
            "🚁 <b>Scout (無人機任務) 回覆：</b>",
        )
    )
