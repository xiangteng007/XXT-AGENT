"""
handlers/advisory.py — Lex / Sage / Zora agent handlers (v9.2)

Handles:
  /lex   — 法務諮詢 (Legal Advisor)
  /sage  — 數據分析 (Data Analytics)
  /zora  — CSR 與非營利 (Corporate Social Responsibility)

These are thin wrappers that:
1. Emit audit events for all invocations (advisory actions have governance implications)
2. Forward to the gateway via call_agent_and_reply()
"""
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..config import Settings

from ..tg_api import send_message
from .audit import emit_cmd_audit

logger = logging.getLogger("telegram-command-bot.advisory")

# ── Agent config map ─────────────────────────────────────────────────────────

_AGENTS = {
    "/lex": {
        "icon": "⚖️",
        "name": "Lex (法務諮詢)",
        "prefix": "[法務諮詢]",
        "agent_path": "/agents/lex/chat",
        "thinking_msg": "收到您的法務問題，正在為您檢閱合約與智財資料...",
        "reply_header": "⚖️ <b>Lex (法務諮詢) 回覆：</b>",
    },
    "/sage": {
        "icon": "📊",
        "name": "Sage (數據分析)",
        "prefix": "[數據分析]",
        "agent_path": "/agents/sage/chat",
        "thinking_msg": "收到您的數據需求，正在進行統計與解讀...",
        "reply_header": "📊 <b>Sage (數據分析) 回覆：</b>",
    },
    "/zora": {
        "icon": "🌱",
        "name": "Zora (CSR 與非營利)",
        "prefix": "[CSR 與非營利]",
        "agent_path": "/agents/zora/chat",
        "thinking_msg": "收到您的 CSR 查詢，正在提供企業社會責任計畫建議...",
        "reply_header": "🌱 <b>Zora (CSR 與非營利) 回覆：</b>",
    },
}


async def _dispatch(
    cmd: str,
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
    _call_agent_fn,
) -> None:
    """Generic dispatcher for Lex / Sage / Zora."""
    cfg = _AGENTS[cmd]
    user_msg = " ".join(args).strip()

    if not user_msg:
        await send_message(
            settings.telegram_bot_token,
            chat_id,
            f"{cfg['icon']} <b>{cfg['name']}</b>\n\n"
            f"請在指令後輸入您的問題。\n"
            f"例: <code>{cmd} 合約違約金條款如何擬定？</code>",
            parse_mode="HTML",
        )
        return

    # Emit audit (advisory actions → governance trail)
    asyncio.create_task(
        emit_cmd_audit(
            settings,
            chat_id,
            cmd,
            {"user_query": user_msg[:200]},
        )
    )

    await send_message(
        settings.telegram_bot_token,
        chat_id,
        f"{cfg['icon']} <b>{cfg['name']}</b>\n{cfg['thinking_msg']}",
        parse_mode="HTML",
    )

    asyncio.create_task(
        _call_agent_fn(
            settings.openclaw_gateway_url,
            settings.telegram_bot_token,
            chat_id,
            cfg["agent_path"],
            f"{cfg['prefix']} {user_msg}",
            cfg["reply_header"],
        )
    )


async def handle_lex(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
    _call_agent_fn,
) -> None:
    """⚖️ /lex — 法務諮詢"""
    await _dispatch("/lex", args, chat_id, settings, _call_agent_fn)


async def handle_sage(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
    _call_agent_fn,
) -> None:
    """📊 /sage — 數據分析"""
    await _dispatch("/sage", args, chat_id, settings, _call_agent_fn)


async def handle_zora(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
    _call_agent_fn,
) -> None:
    """🌱 /zora — CSR 與非營利"""
    await _dispatch("/zora", args, chat_id, settings, _call_agent_fn)
