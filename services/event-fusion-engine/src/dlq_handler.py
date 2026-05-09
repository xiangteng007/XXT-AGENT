"""
DLQ (Dead Letter Queue) consumer for event-fusion-engine.
Handles failed messages from events.dlq topic via Pub/Sub push.
"""
import json
import logging
import os
import base64
from datetime import datetime, timezone

from aiohttp import web
from google.cloud import firestore, pubsub_v1

logger = logging.getLogger(__name__)

# Firestore client (lazy init)
_fs_client: firestore.AsyncClient | None = None


def _get_firestore() -> firestore.AsyncClient:
    global _fs_client
    if _fs_client is None:
        _fs_client = firestore.AsyncClient()
    return _fs_client


async def handle_dlq(request: web.Request) -> web.Response:
    """
    Consume messages from events.dlq via Pub/Sub push subscription.
    Records to Firestore system_errors collection + publishes Telegram alert
    via audit.log topic.
    """
    try:
        body = await request.json()
    except Exception:
        logger.error("DLQ handler: invalid JSON body")
        return web.Response(status=400, text="invalid json")

    # Extract Pub/Sub message
    message = body.get("message", {})
    msg_data_b64 = message.get("data", "")
    attributes = message.get("attributes", {})
    message_id = message.get("messageId", "unknown")
    subscription = body.get("subscription", "unknown")

    # Decode payload
    try:
        raw = base64.b64decode(msg_data_b64).decode("utf-8")
        payload = json.loads(raw)
    except Exception as e:
        payload = {"raw_b64": msg_data_b64, "decode_error": str(e)}

    error_record = {
        "message_id": message_id,
        "subscription": subscription,
        "attributes": attributes,
        "payload": payload,
        "dead_letter_reason": attributes.get("CloudPubSubDeadLetterSourceSubscription", "unknown"),
        "delivery_attempt": attributes.get("CloudPubSubDeliveryAttempt", "0"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending_review",
    }

    # Write to Firestore system_errors collection
    try:
        fs = _get_firestore()
        await fs.collection("system_errors").document(message_id).set(error_record)
        logger.info(f"DLQ: recorded error to Firestore: {message_id}")
    except Exception as e:
        logger.error(f"DLQ: Firestore write failed: {e}")

    # Publish audit alert
    await _publish_dlq_alert(error_record)

    # Always ACK to prevent infinite re-delivery of DLQ messages
    return web.Response(status=204)


async def _publish_dlq_alert(error_record: dict) -> None:
    """Publish DLQ alert to audit.log topic AND send direct Telegram notification."""
    topic_id = os.getenv("TOPIC_AUDIT_LOG", "audit.log")
    project_id = os.getenv("GCP_PROJECT_ID", "")

    # ── 1) Pub/Sub audit.log ────────────────────────────────────────
    if project_id:
        try:
            publisher = pubsub_v1.PublisherClient()
            topic_path = publisher.topic_path(project_id, topic_id)

            alert_payload = {
                "service": "event-fusion-engine",
                "event_type": "dlq_message",
                "severity": "HIGH",
                "message_id": error_record["message_id"],
                "dead_letter_reason": error_record["dead_letter_reason"],
                "delivery_attempt": error_record["delivery_attempt"],
                "ts": error_record["created_at"],
            }

            publisher.publish(
                topic_path,
                data=json.dumps(alert_payload).encode("utf-8"),
                source="dlq-handler",
            )
            logger.info(f"DLQ: published audit alert for {error_record['message_id']}")
        except Exception as e:
            logger.error(f"DLQ: failed to publish audit alert: {e}")
    else:
        logger.warning("DLQ alert: GCP_PROJECT_ID not set, skipping Pub/Sub alert")

    # ── 2) Direct Telegram push ─────────────────────────────────────
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    admin_chat_id = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")

    if not bot_token or not admin_chat_id:
        logger.warning("DLQ alert: TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not set, skipping Telegram push")
        return

    try:
        import aiohttp
        attempt = error_record.get("delivery_attempt", "?")
        reason = error_record.get("dead_letter_reason", "unknown")[:100]
        msg_id = error_record.get("message_id", "unknown")
        ts = error_record.get("created_at", "")[:19]

        text = (
            "🚨 <b>[DLQ 警報] 訊息處理失敗</b>\n"
            "━━━━━━━━━━━━━━━\n"
            f"📌 訊息 ID: <code>{msg_id}</code>\n"
            f"🔁 嘗試次數: {attempt}\n"
            f"📋 失敗原因: {reason}\n"
            f"🕒 時間: {ts}\n\n"
            "⚠️ 請至 Firestore <code>system_errors</code> 集合查看詳情。"
        )

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": admin_chat_id,
            "text": text,
            "parse_mode": "HTML",
        }

        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=10)
        ) as session:
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    logger.info(f"DLQ: Telegram alert sent to {admin_chat_id}")
                else:
                    body = await resp.text()
                    logger.error(f"DLQ: Telegram push failed: {resp.status} {body[:200]}")

    except Exception as e:
        logger.error(f"DLQ: Telegram push exception: {e}")

