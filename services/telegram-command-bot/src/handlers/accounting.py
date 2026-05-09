"""
handlers/accounting.py — Kay 會計幕僚 handler (v9.2)

Thin shim for /acc command:
- Emits audit events for report / export / ledger write operations
- Delegates full logic to main.py's handle_acc() to avoid duplication

Commands: /acc
"""
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..config import Settings

from .audit import emit_cmd_audit

logger = logging.getLogger("telegram-command-bot.accounting")

# Sub-commands that should be audited (data mutations or sensitive reports)
_AUDIT_SUBS = {"ledger", "report", "export", "bank", "entity", "taxplan"}


async def handle_accounting(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
    _handle_acc_fn,
) -> None:
    """
    Entry point for /acc command (v9.2).
    Emits audit trail for write/report operations, then delegates to full
    handle_acc() implementation in main.py to avoid duplicating logic.
    """
    sub = args[0].lower() if args else ""

    if sub in _AUDIT_SUBS:
        # Include the sub-action too (e.g. ledger add vs ledger list)
        action = args[1].lower() if len(args) > 1 else ""
        asyncio.create_task(
            emit_cmd_audit(
                settings,
                chat_id,
                "/acc",
                {"subcommand": sub, "action": action},
            )
        )

    await _handle_acc_fn(args, chat_id, settings)
