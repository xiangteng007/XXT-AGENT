"""
Social Dispatcher Service
=========================
Receives social monitoring events and dispatches notifications
to configured channels (Firestore, Telegram, LINE).

Endpoints:
  POST /dispatch       - Trigger social source collection via Cloud Tasks
  POST /pubsub/push    - Receive Pub/Sub push messages (social.raw topic)
  POST /notify         - Deliver notification to channels
  GET  /healthz        - Health check
  GET  /status         - Service status summary
"""

from fastapi import FastAPI, Request, HTTPException
import uvicorn
import logging
import os
import json
import base64
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("social-dispatcher")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="Social Dispatcher", version="1.0.0")

# ── Config ────────────────────────────────────────────────────
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "xxt-agent")
REGION = os.getenv("GCP_REGION", "asia-east1")
ENV = os.getenv("ENV", "prod")
TASK_QUEUE = os.getenv("SOCIAL_TASK_QUEUE", "social-collect-queue")
WORKER_URL = os.getenv("SOCIAL_WORKER_URL", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# ── Stats ─────────────────────────────────────────────────────
stats = {
    "dispatched": 0,
    "pubsub_received": 0,
    "notifications_sent": 0,
    "errors": 0,
    "started_at": datetime.now(timezone.utc).isoformat(),
}

# ── Lazy Clients ──────────────────────────────────────────────
_db = None
_tasks_client = None

def get_db():
    global _db
    if _db is None:
        try:
            from google.cloud import firestore
            _db = firestore.Client()
        except Exception as e:
            logger.error(f"Firestore init failed: {e}")
    return _db

def get_tasks_client():
    global _tasks_client
    if _tasks_client is None:
        try:
            from google.cloud import tasks_v2
            _tasks_client = tasks_v2.CloudTasksClient()
        except Exception as e:
            logger.error(f"Cloud Tasks init failed: {e}")
    return _tasks_client


# ── Dispatch Endpoint ─────────────────────────────────────────
@app.post("/dispatch")
async def handle_dispatch(request: Request):
    """Trigger social source collection via Cloud Tasks."""
    body = await request.json()
    tenant_id = body.get("tenantId", "default")
    
    logger.info(f"Dispatching social monitoring for tenant: {tenant_id}")
    
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Firestore unavailable")
    
    # Query enabled sources
    sources_ref = db.collection("social_sources").document(tenant_id).collection("sources")
    docs = sources_ref.where("enabled", "==", True).stream()
    
    enqueued = 0
    found_any = False
    
    tasks_client = get_tasks_client()
    
    for doc in docs:
        found_any = True
        src = doc.to_dict()
        payload = {
            "tenantId": tenant_id,
            "sourceId": doc.id,
            "platform": src.get("platform", "unknown"),
            "config": src.get("config", {})
        }
        
        if tasks_client and WORKER_URL:
            try:
                parent = tasks_client.queue_path(PROJECT_ID, REGION, TASK_QUEUE)
                task = {
                    "http_request": {
                        "http_method": "POST",
                        "url": f"{WORKER_URL}/work",
                        "headers": {"Content-Type": "application/json"},
                        "body": json.dumps(payload).encode("utf-8")
                    }
                }
                tasks_client.create_task(parent=parent, task=task)
                enqueued += 1
            except Exception as e:
                logger.error(f"Failed to enqueue task: {e}")
                stats["errors"] += 1
        else:
            logger.warning("Cloud Tasks or WORKER_URL not configured, skipping enqueue")
    
    if not found_any and tenant_id == "default":
        logger.info("No sources found for default tenant. Creating RSS stub...")
        from google.cloud import firestore as fs
        default_src = {
            "enabled": True,
            "platform": "rss",
            "mode": "poll",
            "config": {"keywordRules": ["災害", "停電", "火災", "AI", "半導體"]},
            "createdAt": fs.SERVER_TIMESTAMP,
            "updatedAt": fs.SERVER_TIMESTAMP
        }
        sources_ref.document("rss_stub").set(default_src)
        enqueued = 1

    stats["dispatched"] += enqueued
    logger.info(f"Dispatch complete. Enqueued {enqueued} tasks.")
    return {"ok": True, "tenantId": tenant_id, "enqueued": enqueued}


# ── Pub/Sub Push Receiver ─────────────────────────────────────
@app.post("/pubsub/push")
async def handle_pubsub(request: Request):
    """
    Receive Pub/Sub push messages from social.raw topic.
    Processes incoming social posts and writes to Firestore + dispatches alerts.
    """
    envelope = await request.json()
    stats["pubsub_received"] += 1
    
    # Decode Pub/Sub message
    message = envelope.get("message", {})
    data_b64 = message.get("data", "")
    
    if not data_b64:
        return {"ok": True, "status": "empty message"}
    
    try:
        raw = json.loads(base64.b64decode(data_b64).decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to decode Pub/Sub message: {e}")
        stats["errors"] += 1
        return {"ok": False, "error": "decode_failed"}
    
    # Write to Firestore social_posts collection
    db = get_db()
    if db:
        try:
            post_ref = db.collection("social_posts").document()
            post_ref.set({
                **raw,
                "processedAt": datetime.now(timezone.utc).isoformat(),
                "source": "pubsub",
            })
            logger.info(f"Stored social post: {post_ref.id}")
        except Exception as e:
            logger.error(f"Firestore write failed: {e}")
            stats["errors"] += 1
    
    # Check if post matches alert rules
    severity = raw.get("severity", 0)
    if severity and severity >= 7:
        await _send_alert(raw)
    
    return {"ok": True, "postId": raw.get("id", "unknown")}


# ── Notification Delivery ─────────────────────────────────────
@app.post("/notify")
async def handle_notify(request: Request):
    """Send notification to configured channels."""
    body = await request.json()
    channel = body.get("channel", "firestore")
    message = body.get("message", "")
    title = body.get("title", "通知")
    severity = body.get("severity", "info")
    
    if channel == "telegram" and TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        await _send_telegram(title, message)
    
    # Always write to Firestore for dashboard consumption
    db = get_db()
    if db:
        db.collection("fused_events").add({
            "title": title,
            "summary": message,
            "domain": body.get("domain", "social"),
            "severity": _severity_to_int(severity),
            "ts": datetime.now(timezone.utc).isoformat(),
            "source": "social-dispatcher",
        })
    
    stats["notifications_sent"] += 1
    return {"ok": True, "channel": channel}


# ── Health & Status ───────────────────────────────────────────
@app.get("/healthz")
@app.get("/health")
async def healthz():
    return {"ok": True, "service": "social-dispatcher", "version": "1.0.0", "env": ENV}


@app.get("/status")
async def status():
    return {
        "service": "social-dispatcher",
        "version": "1.0.0",
        "env": ENV,
        "stats": stats,
        "config": {
            "project_id": PROJECT_ID,
            "region": REGION,
            "worker_url": WORKER_URL[:20] + "..." if WORKER_URL else "(not set)",
            "telegram_configured": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
        }
    }


# ── Internal Helpers ──────────────────────────────────────────
async def _send_alert(post: dict):
    """Send high-severity social alert to Telegram + Firestore."""
    title = f"⚠️ 社群警報: {post.get('platform', 'unknown')}"
    message = post.get("content", "")[:200]
    
    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        await _send_telegram(title, message)
    
    db = get_db()
    if db:
        db.collection("fused_events").add({
            "title": title,
            "summary": message,
            "domain": "social",
            "severity": post.get("severity", 7),
            "ts": datetime.now(timezone.utc).isoformat(),
            "source": "social-dispatcher",
            "postId": post.get("id"),
        })
    
    stats["notifications_sent"] += 1
    logger.info(f"Alert sent: {title}")


async def _send_telegram(title: str, message: str):
    """Send message via Telegram Bot API."""
    import httpx
    
    text = f"*{title}*\n\n{message}"
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": "Markdown",
            })
    except Exception as e:
        logger.error(f"Telegram send failed: {e}")
        stats["errors"] += 1


def _severity_to_int(severity: str) -> int:
    mapping = {"info": 2, "warning": 5, "error": 8, "critical": 10}
    return mapping.get(severity, 3)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
