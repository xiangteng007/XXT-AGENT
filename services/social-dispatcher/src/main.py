from fastapi import FastAPI, Request
import uvicorn
import logging
import os
from google.cloud import firestore
from google.cloud import tasks_v2
import json
import base64

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("social-dispatcher")

app = FastAPI()

# Clients
db = firestore.Client()
tasks_client = tasks_v2.CloudTasksClient()

# Config
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "")
REGION = os.getenv("GCP_REGION", "asia-east1")
ENV = os.getenv("ENV", "prod")
TASK_QUEUE = os.getenv("SOCIAL_TASK_QUEUE", "social-collect-queue")
WORKER_URL = os.getenv("SOCIAL_WORKER_URL", "") # Must be set via Terraform

def enqueue_task(payload: dict):
    parent = tasks_client.queue_path(PROJECT_ID, REGION, TASK_QUEUE)
    
    # Construct task
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": f"{WORKER_URL}/work",
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(payload).encode("utf-8")
        }
    }
    
    tasks_client.create_task(parent=parent, task=task)

@app.post("/dispatch")
async def handle_dispatch(request: Request):
    body = await request.json()
    tenant_id = body.get("tenantId", "default")
    
    logger.info(f"Dispatching social monitoring for tenant: {tenant_id}")
    
    # Query sources
    sources_ref = db.collection("social_sources").document(tenant_id).collection("sources")
    docs = sources_ref.where("enabled", "==", True).stream()
    
    enqueued = 0
    found_any = False
    for doc in docs:
        found_any = True
        src = doc.to_dict()
        payload = {
            "tenantId": tenant_id,
            "sourceId": doc.id,
            "platform": src.get("platform", "unknown"),
            "config": src.get("config", {})
        }
        enqueue_task(payload)
        enqueued += 1
        
    if not found_any and tenant_id == "default":
        # Create default stub if nothing exists (MVP behavior)
        logger.info("No sources found for default tenant. Creating stub...")
        default_src = {
            "enabled": True,
            "platform": "rss",
            "mode": "poll",
            "config": {"keywordRules": ["災害", "停電", "火災"]},
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP
        }
        sources_ref.document("rss_stub").set(default_src)
        
        # Enqueue the newly created stub
        payload = {
            "tenantId": tenant_id,
            "sourceId": "rss_stub",
            "platform": "rss",
            "config": default_src["config"]
        }
        enqueue_task(payload)
        enqueued = 1

    logger.info(f"Dispatch complete. Enqueued {enqueued} tasks.")
    return {"ok": True, "tenantId": tenant_id, "enqueued": enqueued}

@app.get("/healthz")
async def healthz():
    return {"ok": True, "service": "social-dispatcher", "env": ENV}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
