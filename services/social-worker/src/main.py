"""
Social Worker Service
Fetches posts from real social media platforms (Reddit, PTT) and publishes to Pub/Sub.
"""
from fastapi import FastAPI, Request, HTTPException
import uvicorn
import logging
import os
import hashlib
import json
from google.cloud import pubsub_v1
from datetime import datetime
import pytz
from typing import List, Dict, Any, Optional
import asyncio

from adapters import create_adapter, RedditAdapter, PTTAdapter, TwitterAdapter, WeiboAdapter, FacebookAdapter

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("social-worker")

app = FastAPI(title="Social Worker", version="2.0.0")

# Pub/Sub
publisher = pubsub_v1.PublisherClient()

# Config
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "")
TOPIC_RAW_SOCIAL = os.getenv("TOPIC_RAW_SOCIAL", "raw-social-events")

# Feature flags
USE_REAL_ADAPTERS = os.getenv("USE_REAL_ADAPTERS", "true").lower() == "true"


def get_iso_now_taipei() -> str:
    taipei = pytz.timezone("Asia/Taipei")
    return datetime.now(taipei).isoformat()


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


async def fetch_real_posts(platform: str, config: dict) -> List[Dict[str, Any]]:
    """
    Fetch real posts from social media platforms.
    
    Config options:
    - For Reddit:
        - subreddit: str (default: "taiwan")
        - sort: str (default: "new") 
        - limit: int (default: 25)
        - search_query: str (optional, for keyword search)
    - For PTT:
        - board: str (default: "Gossiping")
        - pages: int (default: 1)
    """
    adapter = create_adapter(platform)
    
    if not adapter:
        logger.warning(f"No adapter for platform: {platform}, using stub")
        return stub_fetch_posts(platform, config)
    
    posts = []
    
    try:
        if platform.lower() == "reddit":
            subreddit = config.get("subreddit", "taiwan")
            sort = config.get("sort", "new")
            limit = config.get("limit", 25)
            search_query = config.get("search_query")
            
            if search_query:
                posts = await adapter.search_subreddit(subreddit, search_query, limit)
            else:
                posts, _ = await adapter.fetch_subreddit(subreddit, sort, limit)
                
        elif platform.lower() == "ptt":
            board = config.get("board", "Gossiping")
            pages = config.get("pages", 1)
            
            posts = await adapter.fetch_board(board, pages)
            
            # Optionally filter by keywords
            keywords = config.get("keywordRules", [])
            if keywords:
                posts = [
                    p for p in posts 
                    if any(kw.lower() in p["title"].lower() for kw in keywords)
                ]
        
        elif platform.lower() in ("twitter", "x"):
            username = config.get("username")
            search_query = config.get("search_query")
            limit = config.get("limit", 20)
            
            if username:
                posts = await adapter.fetch_user_timeline(username, limit)
            elif search_query:
                posts = await adapter.search_tweets(search_query, limit)
            else:
                logger.warning("Twitter requires 'username' or 'search_query' in config")
        
        elif platform.lower() == "weibo":
            keyword = config.get("keyword") or config.get("search_query")
            if keyword:
                posts = await adapter.search_posts(keyword)
            else:
                # Fetch hot topics as fallback
                topics = await adapter.fetch_hot_topics()
                posts = [{
                    "postId": f"hot_{i}",
                    "title": t.get("topic", ""),
                    "text": f"熱度: {t.get('hot', 0)}",
                    "url": t.get("url", ""),
                    "author": "weibo_hot",
                    "createdAt": datetime.now().isoformat(),
                    "likes": t.get("hot", 0),
                    "comments": 0,
                    "shares": 0,
                    "views": 0,
                } for i, t in enumerate(topics[:20])]
        
        elif platform.lower() in ("facebook", "fb"):
            page_id = config.get("page_id") or config.get("pageId")
            limit = config.get("limit", 25)
            
            if page_id:
                posts = await adapter.fetch_page_posts(page_id, limit)
            else:
                logger.warning("Facebook requires 'page_id' in config")
                
    except Exception as e:
        logger.error(f"Error fetching from {platform}: {e}")
        return []
    
    return posts


def stub_fetch_posts(platform: str, config: dict) -> List[Dict[str, Any]]:
    """MVP stub: generate a synthetic post for testing."""
    import random
    keywords = config.get("keywordRules", ["地震", "停電"])
    kw = random.choice(keywords) if keywords else "測試"
    title = f"{platform.upper()} 爆量訊號：{kw}（Stub）"
    url = f"https://social.example.com/post/{random.randint(1000, 9999)}"
    
    return [{
        "postId": f"p_{int(datetime.now().timestamp())}",
        "title": title,
        "text": f"{kw} 相關貼文快速增加，區域分布在北中南。",
        "url": url,
        "author": "stub_user",
        "createdAt": datetime.now().isoformat(),
        "likes": random.randint(0, 500),
        "comments": random.randint(0, 150),
        "shares": random.randint(0, 80),
        "views": random.randint(0, 5000)
    }]


@app.get("/healthz")
async def healthz():
    """Health check endpoint for Cloud Run"""
    return {
        "status": "ok",
        "service": "social-worker",
        "version": "2.2.0",
        "platforms": ["reddit", "ptt", "twitter", "weibo", "facebook"]
    }


@app.post("/work")
async def handle_work(request: Request):
    """
    Process a social collect job.
    
    Expected payload:
    {
        "tenantId": "string",
        "sourceId": "string",
        "platform": "reddit" | "ptt",
        "config": {
            // For Reddit:
            "subreddit": "taiwan",
            "sort": "new",
            "limit": 25,
            "search_query": "optional keyword"
            
            // For PTT:
            "board": "Gossiping",
            "pages": 1,
            "keywordRules": ["地震", "停電"]
        }
    }
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    tenant_id = payload.get("tenantId")
    source_id = payload.get("sourceId")
    platform = payload.get("platform")
    config = payload.get("config", {})
    
    if not tenant_id or not source_id or not platform:
        raise HTTPException(status_code=400, detail="Missing required fields: tenantId, sourceId, platform")

    ts = get_iso_now_taipei()
    
    # Fetch posts from real platform or stub
    if USE_REAL_ADAPTERS:
        items = await fetch_real_posts(platform, config)
    else:
        items = stub_fetch_posts(platform, config)
    
    if not items:
        logger.info(f"No items fetched for {platform}:{source_id}")
        return {"ok": True, "published": 0, "fetched": 0}
    
    published = 0
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC_RAW_SOCIAL) if PROJECT_ID and TOPIC_RAW_SOCIAL else None

    for it in items:
        # Use first 10 chars of TS (YYYY-MM-DD) for dedup to avoid repeat alert on same day
        dedup_seed = f"{it.get('title', '')}|{it.get('url', '')}|{ts[:10]}"
        dedup_hash = sha256(dedup_seed)
        
        evt = {
            "id": f"raws_{int(datetime.now().timestamp())}_{source_id}_{it.get('postId', '')}",
            "ts": ts,
            "source": "social",
            "tenantId": tenant_id,
            "platform": platform,
            "sourceId": source_id,
            "postId": it.get("postId", ""),
            "title": it.get("title", ""),
            "text": it.get("text", ""),
            "url": it.get("url", ""),
            "author": it.get("author", ""),
            "createdAt": it.get("createdAt", ts),
            "engagement": {
                "likes": it.get("likes", 0),
                "comments": it.get("comments", 0),
                "shares": it.get("shares", 0),
                "views": it.get("views", 0)
            },
            "dedupHash": dedup_hash,
            "metadata": {
                "subreddit": it.get("subreddit"),
                "board": it.get("board"),
                "flair": it.get("flair"),
            }
        }
        
        # Publish to Pub/Sub if configured
        if topic_path:
            try:
                data = json.dumps(evt).encode("utf-8")
                future = publisher.publish(topic_path, data)
                future.result()  # Wait for publish
                published += 1
            except Exception as e:
                logger.error(f"Pub/Sub publish error: {e}")
        else:
            # Log only mode (for testing without Pub/Sub)
            logger.info(f"Would publish: {evt['title'][:50]}...")
            published += 1
        
    logger.info(f"Worker done. Fetched {len(items)}, published {published} items for tenant {tenant_id}")
    return {"ok": True, "published": published, "fetched": len(items)}


@app.get("/healthz")
async def healthz():
    return {
        "ok": True, 
        "service": "social-worker",
        "version": "2.2.0",
        "real_adapters": USE_REAL_ADAPTERS,
        "supported_platforms": ["reddit", "ptt", "twitter", "weibo", "facebook"]
    }


@app.get("/platforms")
async def list_platforms():
    """List supported platforms and their configuration options."""
    return {
        "platforms": {
            "reddit": {
                "description": "Reddit subreddit scraper (no API key required)",
                "config": {
                    "subreddit": "Subreddit name (without r/)",
                    "sort": "new | hot | top | rising",
                    "limit": "Number of posts (max 100)",
                    "search_query": "Optional keyword search"
                }
            },
            "ptt": {
                "description": "PTT board scraper",
                "config": {
                    "board": "Board name (e.g., Gossiping, Stock, Tech_Job)",
                    "pages": "Number of pages to fetch",
                    "keywordRules": "List of keywords to filter by"
                }
            },
            "twitter": {
                "description": "Twitter/X timeline or search (API key optional, uses Nitter fallback)",
                "aliases": ["x"],
                "config": {
                    "username": "Twitter username to fetch timeline",
                    "search_query": "Keyword search (requires API key)",
                    "limit": "Number of tweets (max 100)"
                },
                "env_vars": {
                    "TWITTER_BEARER_TOKEN": "Optional: Twitter API v2 Bearer Token for full access"
                }
            },
            "weibo": {
                "description": "Weibo (微博) Chinese social media",
                "config": {
                    "keyword": "Search keyword",
                    "search_query": "Alternative to keyword"
                },
                "notes": "If no keyword provided, fetches hot topics"
            },
            "facebook": {
                "description": "Facebook page posts (requires API access token)",
                "aliases": ["fb"],
                "config": {
                    "page_id": "Facebook Page ID or username",
                    "limit": "Number of posts (max 100)"
                },
                "env_vars": {
                    "FACEBOOK_ACCESS_TOKEN": "Required: Facebook Graph API access token"
                },
                "notes": "Only public page posts are accessible due to privacy policies"
            }
        }
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)

