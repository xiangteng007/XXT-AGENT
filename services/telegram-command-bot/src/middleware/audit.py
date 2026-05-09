"""
Audit middleware for telegram-command-bot.
Publishes command execution audit events to audit.log Pub/Sub topic.
"""
import json
import logging
import os
import time
from functools import wraps
from typing import Callable, Awaitable, Any

from google.cloud import pubsub_v1

logger = logging.getLogger(__name__)

_publisher: pubsub_v1.PublisherClient | None = None
_topic_path: str | None = None


def _get_publisher() -> tuple[pubsub_v1.PublisherClient, str] | tuple[None, None]:
    global _publisher, _topic_path
    if _publisher is None:
        project_id = os.getenv("GCP_PROJECT_ID", "")
        topic_id = os.getenv("TOPIC_AUDIT_LOG", "audit.log")
        if not project_id:
            return None, None
        try:
            _publisher = pubsub_v1.PublisherClient()
            _topic_path = _publisher.topic_path(project_id, topic_id)
        except Exception as e:
            logger.warning(f"Audit: failed to init publisher: {e}")
            return None, None
    return _publisher, _topic_path


async def publish_audit_event(
    *,
    user_id: int,
    command: str,
    status: str = "ok",
    latency_ms: int = 0,
    error: str | None = None,
    extra: dict | None = None,
) -> None:
    """
    Publish a command execution audit event to audit.log topic.
    Fire-and-forget (never blocks the handler).
    """
    publisher, topic_path = _get_publisher()
    if publisher is None or topic_path is None:
        return

    event = {
        "service": "telegram-command-bot",
        "event_type": "command_execution",
        "cmd": command,
        "user_id": user_id,
        "status": status,
        "latency_ms": latency_ms,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    if error:
        event["error"] = error
    if extra:
        event.update(extra)

    try:
        publisher.publish(
            topic_path,
            data=json.dumps(event).encode("utf-8"),
            source="telegram-command-bot",
            cmd=command,
        )
    except Exception as e:
        logger.warning(f"Audit publish failed (non-critical): {e}")
