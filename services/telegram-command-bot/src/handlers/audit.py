"""
handlers/audit.py — Telegram Command Audit Logger (v9.1)

Emits audit events to GCP Pub/Sub audit.log topic for critical user commands.
Used by: /analyze, /acc, /ins, /loan, /reg

Usage:
    from .handlers.audit import emit_cmd_audit
    asyncio.create_task(emit_cmd_audit(settings, chat_id, "/analyze", {"sym": sym}))
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger("telegram-command-bot.audit")


async def emit_cmd_audit(
    settings,
    chat_id: int | str,
    command: str,
    metadata: dict | None = None,
) -> None:
    """
    Publish a command audit event to Pub/Sub audit.log topic.
    Non-blocking — safe to run via asyncio.create_task().
    Silently swallows all errors to avoid breaking the UX.
    """
    # Require both project_id and topic to be configured
    project_id = getattr(settings, "gcp_project_id", "")
    topic_id = getattr(settings, "topic_audit_log", "audit.log")

    if not project_id or not topic_id:
        logger.debug(f"[Audit] Skipping {command}: GCP_PROJECT_ID or TOPIC_AUDIT_LOG not set")
        return

    event = {
        "schema_version": "1.0",
        "event_type": "audit",
        "audit_id": str(uuid.uuid4()),
        "action": "telegram_command",
        "resource": command,
        "actor": f"telegram_user:{chat_id}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "chat_id": str(chat_id),
            "command": command,
            **(metadata or {}),
        },
    }

    try:
        from google.cloud import pubsub_v1

        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(project_id, topic_id)
        publisher.publish(
            topic_path,
            data=json.dumps(event, ensure_ascii=False).encode("utf-8"),
            source="telegram-command-bot",
        )
        logger.info(f"[Audit] Published: {command} by {chat_id}")
    except Exception as e:
        logger.warning(f"[Audit] Failed to publish audit event for {command}: {e}")
