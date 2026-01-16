from fastapi import FastAPI, Request
import uvicorn
import logging
import os
import hashlib
import json
from google.cloud import pubsub_v1
from datetime import datetime
import pytz

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("social-worker")

app = FastAPI()

# Pub/Sub
publisher = pubsub_v1.PublisherClient()

# Config
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "")
TOPIC_RAW_SOCIAL = os.getenv("TOPIC_RAW_SOCIAL", "")

def get_iso_now_taipei():
    taipei = pytz.timezone("Asia/Taipei")
    return datetime.now(taipei).isoformat()

def sha256(s: str):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def stub_fetch_posts(platform: str, config: dict):
    # MVP stub: generate a synthetic post
    keywords = config.get("keywordRules", ["地震", "停電"])
    import random
    kw = random.choice(keywords)
    title = f"{platform.upper()} 爆量訊號：{kw}（Python MVP stub）"
    url = f"https://social.example.com/post/{random.randint(1000, 9999)}"
    
    return [{
        "postId": f"p_{int(datetime.now().timestamp())}",
        "title": title,
        "text": f"{kw} 相關貼文快速增加，區域分布在北中南。",
        "url": url,
        "likes": random.randint(0, 500),
        "comments": random.randint(0, 150),
        "shares": random.randint(0, 80),
        "views": random.randint(0, 5000)
    }]

@app.post("/work")
async def handle_work(request: Request):
    try:
        payload = await request.json()
    except Exception:
        return {"ok": False, "error": "invalid json"}, 400
        
    tenant_id = payload.get("tenantId")
    source_id = payload.get("sourceId")
    platform = payload.get("platform")
    config = payload.get("config", {})
    
    if not tenant_id or not source_id or not platform:
        return {"ok": False, "error": "missing fields"}, 400

    ts = get_iso_now_taipei()
    items = stub_fetch_posts(platform, config)
    published = 0
    
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC_RAW_SOCIAL)

    for it in items:
        # Use first 10 chars of TS (YYYY-MM-DD) for dedup to avoid repeat alert on same day
        dedup_seed = f"{it['title']}|{it['url']}|{ts[:10]}"
        dedup_hash = sha256(dedup_seed)
        
        evt = {
            "id": f"raws_{int(datetime.now().timestamp())}_{source_id}",
            "ts": ts,
            "source": "social",
            "tenantId": tenant_id,
            "platform": platform,
            "sourceId": source_id,
            "postId": it["postId"],
            "title": it["title"],
            "text": it["text"],
            "url": it["url"],
            "engagement": {
                "likes": it["likes"],
                "comments": it["comments"],
                "shares": it["shares"],
                "views": it["views"]
            },
            "dedupHash": dedup_hash
        }
        
        data = json.dumps(evt).encode("utf-8")
        future = publisher.publish(topic_path, data)
        future.result() # Wait for publish
        published += 1
        
    logger.info(f"Worker done. Published {published} items for tenant {tenant_id}")
    return {"ok": True, "published": published}

@app.get("/healthz")
async def healthz():
    return {"ok": True, "service": "social-worker"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
