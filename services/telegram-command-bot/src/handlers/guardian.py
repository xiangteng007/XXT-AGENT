"""
handlers/guardian.py — Insurance & Risk Guardian handlers (v9.1)

Thin shim that delegates to main.py's handle_ins() while adding:
- v9.1 audit log emission via Pub/Sub
- Centralized entry point for future refactoring

Commands: /ins
"""
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..config import Settings

from .audit import emit_cmd_audit

logger = logging.getLogger("telegram-command-bot.guardian")


async def handle_guardian(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
    _handle_ins_fn,  # injected from main.py to avoid circular import
) -> None:
    """
    Entry point for /ins command.
    Emits audit event then delegates to the full handle_ins implementation.
    """
    sub = args[0].lower() if args else "dashboard"

    # Emit audit trail for sensitive insurance operations
    audit_actions = {"analyze", "plan", "policy", "report"}
    if sub in audit_actions:
        asyncio.create_task(
            emit_cmd_audit(
                settings,
                chat_id,
                "/ins",
                {"subcommand": sub},
            )
        )

    # Delegate to full implementation in main.py
    await _handle_ins_fn(args, chat_id, settings)
