"""
News Collector — Main Entry Point

Cloud Run service that:
1. Is triggered by Cloud Scheduler every minute
2. Fetches news from Finnhub market news API
3. Fetches news from configured RSS feeds
4. Deduplicates using Redis (or in-memory fallback)
5. Publishes new items to news.raw Pub/Sub topic
6. Writes directly to Firestore for dashboard display
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from aiohttp import web
import aiohttp
import feedparser

try:
    from google.cloud import firestore
    FIRESTORE_AVAILABLE = True
except ImportError:
    FIRESTORE_AVAILABLE = False

from .config import Settings
from .pubsub import PubSubPublisher
from .redis_dedup import Deduper


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("news-collector")


async def fetch_finnhub_news(api_key: str) -> list[dict]:
    """Fetch general market news from Finnhub API."""
    if not api_key:
        return []
    
    url = f"https://finnhub.io/api/v1/news?category=general&token={api_key}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=15) as resp:
                if resp.status != 200:
                    logger.warning(f"Finnhub API returned {resp.status}")
                    return []
                return await resp.json()
    except Exception as e:
        logger.error(f"Finnhub fetch failed: {e}")
        return []


def parse_rss(urls: list[str]) -> list[dict]:
    """Fetch and parse RSS feeds."""
    items: list[dict] = []

    for url in urls:
        try:
            logger.info(f"Fetching RSS: {url}")
            feed = feedparser.parse(url)
            source_name = getattr(feed.feed, "title", url)[:50]
            
            for entry in feed.entries[:50]:  # Limit per feed
                link = getattr(entry, "link", "") or ""
                title = getattr(entry, "title", "") or ""
                published = getattr(entry, "published", "") or ""
                summary = getattr(entry, "summary", "") or ""
                
                if link:
                    items.append({
                        "source": "rss",
                        "source_name": source_name,
                        "feed_url": url,
                        "url": link,
                        "headline": title,
                        "published": published,
                        "summary": summary[:500] if summary else "",  # Truncate long summaries
                    })
        except Exception as e:
            logger.warning(f"RSS parse failed for {url}: {e}")
            continue
    
    logger.info(f"Parsed {len(items)} RSS items from {len(urls)} feeds")
    return items


def write_to_firestore(db, headline: str, summary: str, url: str, source: str, category: str, ts, image: str = "") -> bool:
    """Write a news item to Firestore (best effort)."""
    try:
        db.collection("market_news").add({
            "headline": headline,
            "summary": summary,
            "url": url,
            "source": source,
            "category": category,
            "ts": ts,
            "image": image,
        })
        return True
    except Exception as e:
        logger.warning(f"Firestore write failed (continuing): {e}")
        return False


async def handle_run(request: web.Request) -> web.Response:
    """Handle scheduler trigger to collect news."""
    settings: Settings = request.app["settings"]
    pub: PubSubPublisher = request.app["pub"]
    dedup: Deduper = request.app["dedup"]
    db = request.app.get("db")

    ingested_at = datetime.now(timezone.utc).isoformat()
    ts = datetime.now(timezone.utc)
    published_count = 0
    skipped_count = 0
    firestore_written = 0

    # 1) Fetch Finnhub market news
    finnhub_items = await fetch_finnhub_news(settings.finnhub_api_key)
    logger.info(f"Got {len(finnhub_items)} items from Finnhub")
    
    for item in finnhub_items[:100]:
        url = item.get("url", "") or ""
        if not url:
            continue
        
        if dedup.seen(url):
            skipped_count += 1
            continue
        
        dedup.mark(url, settings.dedup_ttl_sec)

        event = {
            "schema_version": "1.0",
            "event_type": "news",
            "source": "finnhub",
            "ingested_at": ingested_at,
            "headline": item.get("headline", ""),
            "summary": item.get("summary", ""),
            "url": url,
            "datetime": item.get("datetime", 0),
            "category": item.get("category", ""),
            "related": item.get("related", ""),
            "image": item.get("image", ""),
        }
        
        # Publish to Pub/Sub
        if settings.topic_news_raw:
            pub.publish_json(settings.topic_news_raw, event)
        
        # Write to Firestore for dashboard
        if db:
            if write_to_firestore(db,
                headline=item.get("headline", ""),
                summary=item.get("summary", ""),
                url=url,
                source="finnhub",
                category=item.get("category", "general"),
                ts=ts,
                image=item.get("image", "")):
                firestore_written += 1
        
        published_count += 1

    # 2) Fetch RSS feeds
    rss_urls = settings.rss_url_list()
    logger.info(f"RSS URLs to fetch: {rss_urls}")
    rss_items = parse_rss(rss_urls)
    
    for item in rss_items[:200]:
        url = item.get("url", "") or ""
        if not url:
            continue
        
        if dedup.seen(url):
            skipped_count += 1
            continue
        
        dedup.mark(url, settings.dedup_ttl_sec)

        event = {
            "schema_version": "1.0",
            "event_type": "news",
            "source": "rss",
            "ingested_at": ingested_at,
            "headline": item.get("headline", ""),
            "summary": item.get("summary", ""),
            "url": url,
            "published": item.get("published", ""),
            "feed_url": item.get("feed_url", ""),
        }
        
        # Publish to Pub/Sub
        if settings.topic_news_raw:
            pub.publish_json(settings.topic_news_raw, event)
        
        # Write to Firestore for dashboard
        if db:
            if write_to_firestore(db,
                headline=item.get("headline", ""),
                summary=item.get("summary", ""),
                url=url,
                source=item.get("source_name", "RSS"),
                category="rss",
                ts=ts):
                firestore_written += 1
        
        published_count += 1

    logger.info(f"News collection complete: {published_count} published, {skipped_count} skipped, {firestore_written} written to Firestore")
    
    return web.json_response({
        "ok": True, 
        "published": published_count,
        "skipped": skipped_count,
        "firestore_written": firestore_written
    })


async def handle_health(request: web.Request) -> web.Response:
    """Health check endpoint."""
    return web.json_response({"ok": True})


def create_app() -> web.Application:
    """Create the aiohttp application."""
    settings = Settings()
    
    app = web.Application()
    app["settings"] = settings
    app["pub"] = PubSubPublisher(settings.gcp_project_id)
    app["dedup"] = Deduper(settings.redis_host, settings.redis_port)
    
    # Initialize Firestore (optional)
    if FIRESTORE_AVAILABLE and settings.gcp_project_id:
        try:
            app["db"] = firestore.Client(project=settings.gcp_project_id)
            logger.info("Firestore client initialized")
        except Exception as e:
            logger.warning(f"Firestore init failed: {e}")
            app["db"] = None
    else:
        logger.warning("Firestore not available or no project ID")
        app["db"] = None

    app.router.add_post("/run", handle_run)
    app.router.add_get("/healthz", handle_health)
    
    return app


if __name__ == "__main__":
    logger.info("Starting news-collector service")
    web.run_app(create_app(), host="0.0.0.0", port=8080)
