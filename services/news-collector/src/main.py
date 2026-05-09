"""
News Collector — Main Entry Point (v9.2)

Cloud Run service that:
1. Is triggered by Cloud Scheduler every minute
2. Fetches news from Finnhub market news API
3. Fetches news from configured RSS feeds
4. Deduplicates using Redis (or in-memory fallback)
5. Publishes new items to news.raw Pub/Sub topic
6. Publishes audit events to audit.log Pub/Sub topic (v9.0 new)
7. Writes directly to Firestore for dashboard display
8. Exposes /healthz with Pub/Sub statistics (v9.0 new)
"""
from __future__ import annotations

import logging
import uuid
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
from .pubsub import PubSubPublisher, get_pubsub_stats
from .redis_dedup import Deduper
from .redis_news_cache import NewsCache


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("news-collector")


# ── OpenTelemetry 初始化（可選）───────────────────────────────────

def _init_otel(service_name: str) -> None:
    """初始化 OpenTelemetry（若 OTEL_ENABLED=true）。"""
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource

        resource = Resource.create({"service.name": service_name})
        provider = TracerProvider(resource=resource)

        try:
            from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
            exporter = CloudTraceSpanExporter()
            provider.add_span_processor(BatchSpanProcessor(exporter))
            logger.info("[OTEL] Cloud Trace exporter enabled")
        except ImportError:
            from opentelemetry.sdk.trace.export import ConsoleSpanExporter
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
            logger.info("[OTEL] Console exporter enabled (Cloud Trace SDK not found)")

        trace.set_tracer_provider(provider)
        logger.info(f"[OTEL] TracerProvider initialized for service={service_name}")
    except ImportError:
        logger.info("[OTEL] opentelemetry-sdk not installed, skipping")
    except Exception as e:
        logger.warning(f"[OTEL] Init failed: {e}")


def _get_tracer():
    """取得 tracer（若未安裝 OTEL 則回傳 None）。"""
    try:
        from opentelemetry import trace
        return trace.get_tracer("news-collector")
    except Exception:
        return None


# ── 稽核日誌輔助──────────────────────────────────────────────────

def _emit_audit_event(
    pub: PubSubPublisher,
    topic: str,
    action: str,
    resource: str,
    actor: str = "news-collector",
    metadata: dict | None = None,
    trace_id: str | None = None,
) -> None:
    """發布稽核事件到 audit.log topic（非阻塞）。"""
    if not topic:
        return

    event = {
        "schema_version": "1.0",
        "event_type": "audit",
        "audit_id": str(uuid.uuid4()),
        "action": action,
        "resource": resource,
        "actor": actor,
        "trace_id": trace_id or "",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
    }
    pub.publish_json(topic, event)


# ── Finnhub 抓取 ───────────────────────────────────────────────

async def fetch_finnhub_news(api_key: str, max_items: int = 100) -> list[dict]:
    """Fetch general market news from Finnhub API."""
    if not api_key:
        return []

    url = f"https://finnhub.io/api/v1/news?category=general&token={api_key}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    logger.warning(f"[Finnhub] API returned {resp.status}")
                    return []
                data = await resp.json()
                return data[:max_items] if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"[Finnhub] Fetch failed: {e}")
        return []


# ── RSS 解析 ────────────────────────────────────────────────────

def parse_rss(urls: list[str], max_per_feed: int = 50) -> list[dict]:
    """Fetch and parse RSS feeds."""
    items: list[dict] = []

    for url in urls:
        try:
            feed = feedparser.parse(url)
            source_name = getattr(feed.feed, "title", url)[:50]

            for entry in feed.entries[:max_per_feed]:
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
                        "summary": summary[:500] if summary else "",
                    })
        except Exception as e:
            logger.warning(f"[RSS] Parse failed for {url}: {e}")
            continue

    logger.info(f"[RSS] Parsed {len(items)} items from {len(urls)} feeds")
    return items


# ── CoinGecko 加密貨幣 (v9.2 新增) ────────────────────────────────

async def fetch_coingecko_trending(max_items: int = 7) -> list[dict]:
    """Fetch trending coins from CoinGecko (free API, no key needed)."""
    url = "https://api.coingecko.com/api/v3/search/trending"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    logger.warning(f"[CoinGecko] Trending API returned {resp.status}")
                    return []
                data = await resp.json()
                coins = data.get("coins", [])[:max_items]
                return [
                    {
                        "source": "coingecko",
                        "source_name": "CoinGecko Trending",
                        "headline": (
                            f"\U0001f525 {c['item']['name']} ({c['item']['symbol'].upper()}) trending — "
                            f"Rank #{c['item'].get('market_cap_rank', 'N/A')}"
                        ),
                        "url": f"https://www.coingecko.com/en/coins/{c['item']['id']}",
                        "summary": f"Score: {c['item'].get('score', 'N/A')}",
                        "category": "crypto",
                    }
                    for c in coins
                    if "item" in c
                ]
    except Exception as e:
        logger.error(f"[CoinGecko] Trending fetch failed: {e}")
        return []


async def fetch_coingecko_movers(max_items: int = 10) -> list[dict]:
    """Fetch top market movers (by 24h change) from CoinGecko."""
    url = (
        "https://api.coingecko.com/api/v3/coins/markets"
        "?vs_currency=usd&order=market_cap_desc"
        "&per_page=100&page=1&sparkline=false"
        "&price_change_percentage=24h"
    )
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    logger.warning(f"[CoinGecko] Markets API returned {resp.status}")
                    return []
                data = await resp.json()
                data.sort(
                    key=lambda x: abs(x.get("price_change_percentage_24h", 0) or 0),
                    reverse=True,
                )
                return [
                    {
                        "source": "coingecko",
                        "source_name": "CoinGecko Markets",
                        "headline": (
                            f"\U0001f4ca {c['name']} ({c['symbol'].upper()}) "
                            f"{'\U0001f4c8' if (c.get('price_change_percentage_24h') or 0) > 0 else '\U0001f4c9'} "
                            f"{c.get('price_change_percentage_24h', 0):.1f}% (24h)"
                        ),
                        "url": f"https://www.coingecko.com/en/coins/{c['id']}",
                        "summary": (
                            f"Price: ${c.get('current_price', 0):,.2f} | "
                            f"MCap: ${c.get('market_cap', 0):,.0f}"
                        ),
                        "category": "crypto",
                    }
                    for c in data[:max_items]
                ]
    except Exception as e:
        logger.error(f"[CoinGecko] Markets fetch failed: {e}")
        return []


# ── Firestore 寫入 ──────────────────────────────────────────────

def write_to_firestore(
    db,
    headline: str,
    summary: str,
    url: str,
    source: str,
    category: str,
    ts: datetime,
    image: str = "",
) -> bool:
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
            "ingested_by": "news-collector-v9",  # v9.0 標記
        })
        return True
    except Exception as e:
        logger.warning(f"[Firestore] Write failed (continuing): {e}")
        return False


# ── HTTP Handler: /run ────────────────────────────────────────────

async def handle_run(request: web.Request) -> web.Response:
    """Handle scheduler trigger to collect news."""
    settings: Settings = request.app["settings"]
    pub: PubSubPublisher = request.app["pub"]
    dedup: Deduper = request.app["dedup"]
    news_cache: NewsCache = request.app["news_cache"]
    db = request.app.get("db")

    run_id = str(uuid.uuid4())[:8]
    ingested_at = datetime.now(timezone.utc).isoformat()
    ts = datetime.now(timezone.utc)
    published_count = 0
    skipped_count = 0
    firestore_written = 0

    logger.info(f"[Run:{run_id}] Collection started")

    # ── 1) Finnhub 新聞 ──────────────────────────────────────────
    finnhub_items = await fetch_finnhub_news(
        settings.finnhub_api_key,
        max_items=settings.max_finnhub_items,
    )
    logger.info(f"[Run:{run_id}] Finnhub: {len(finnhub_items)} items")

    for item in finnhub_items:
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
            "run_id": run_id,
            "ingested_at": ingested_at,
            "headline": item.get("headline", ""),
            "summary": item.get("summary", ""),
            "url": url,
            "datetime": item.get("datetime", 0),
            "category": item.get("category", ""),
            "related": item.get("related", ""),
            "image": item.get("image", ""),
        }

        if settings.topic_news_raw:
            pub.publish_json(settings.topic_news_raw, event)

        # v9.1: Push to Redis cache for Telegram /news command
        news_cache.push(
            headline=item.get("headline", ""),
            url=url,
            source="finnhub",
            summary=item.get("summary", ""),
            published_at=ingested_at,
            image=item.get("image", ""),
            related_symbol=item.get("related", "") or None,
        )

        if db:
            if write_to_firestore(
                db,
                headline=item.get("headline", ""),
                summary=item.get("summary", ""),
                url=url,
                source="finnhub",
                category=item.get("category", "general"),
                ts=ts,
                image=item.get("image", ""),
            ):
                firestore_written += 1

        published_count += 1

    # ── 2) RSS 新聞 ──────────────────────────────────────────────
    rss_urls = settings.rss_url_list()
    rss_items = parse_rss(rss_urls, max_per_feed=settings.max_items_per_feed)
    logger.info(f"[Run:{run_id}] RSS: {len(rss_items)} items from {len(rss_urls)} feeds")

    for item in rss_items[:settings.max_rss_items]:
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
            "run_id": run_id,
            "ingested_at": ingested_at,
            "headline": item.get("headline", ""),
            "summary": item.get("summary", ""),
            "url": url,
            "published": item.get("published", ""),
            "feed_url": item.get("feed_url", ""),
            "source_name": item.get("source_name", ""),
        }

        if settings.topic_news_raw:
            pub.publish_json(settings.topic_news_raw, event)

        # v9.1: Push to Redis cache for Telegram /news command
        news_cache.push(
            headline=item.get("headline", ""),
            url=url,
            source=item.get("source_name", "RSS"),
            summary=item.get("summary", ""),
            published_at=item.get("published", ingested_at),
        )

        if db:
            if write_to_firestore(
                db,
                headline=item.get("headline", ""),
                summary=item.get("summary", ""),
                url=url,
                source=item.get("source_name", "RSS"),
                category="rss",
                ts=ts,
            ):
                firestore_written += 1

        published_count += 1

    # ── 3) CoinGecko 加密貨幣（v9.2 新增）─────────────────────────
    coingecko_count = 0
    if settings.coingecko_enabled:
        cg_items = await fetch_coingecko_trending(settings.max_coingecko_trending)
        cg_items += await fetch_coingecko_movers(settings.max_coingecko_movers)
        logger.info(f"[Run:{run_id}] CoinGecko: {len(cg_items)} items")

        for item in cg_items:
            url = item.get("url", "") or ""
            if not url or dedup.seen(url):
                skipped_count += 1
                continue

            dedup.mark(url, settings.dedup_ttl_sec)

            event = {
                "schema_version": "1.0",
                "event_type": "news",
                "source": "coingecko",
                "run_id": run_id,
                "ingested_at": ingested_at,
                "headline": item.get("headline", ""),
                "summary": item.get("summary", ""),
                "url": url,
                "category": "crypto",
            }

            if settings.topic_news_raw:
                pub.publish_json(settings.topic_news_raw, event)

            news_cache.push(
                headline=item.get("headline", ""),
                url=url,
                source="CoinGecko",
                summary=item.get("summary", ""),
                published_at=ingested_at,
            )

            if db:
                if write_to_firestore(
                    db,
                    headline=item.get("headline", ""),
                    summary=item.get("summary", ""),
                    url=url,
                    source="CoinGecko",
                    category="crypto",
                    ts=ts,
                ):
                    firestore_written += 1

            published_count += 1
            coingecko_count += 1

    # ── 4) 發布稽核事件（v9.0 新增）────────────────────────────
    if settings.audit_enabled:
        _emit_audit_event(
            pub=pub,
            topic=settings.topic_audit_log,
            action="news_collection_run",
            resource="news-collector",
            metadata={
                "run_id": run_id,
                "published": published_count,
                "skipped": skipped_count,
                "firestore_written": firestore_written,
                "finnhub_items": len(finnhub_items),
                "rss_feeds": len(rss_urls),
                "coingecko_items": coingecko_count,
            },
        )

    logger.info(
        f"[Run:{run_id}] Done: {published_count} published, "
        f"{skipped_count} skipped, {firestore_written} to Firestore"
    )

    return web.json_response({
        "ok": True,
        "run_id": run_id,
        "published": published_count,
        "skipped": skipped_count,
        "firestore_written": firestore_written,
        "coingecko": coingecko_count,
    })


# ── HTTP Handler: /healthz ────────────────────────────────────────

async def handle_health(request: web.Request) -> web.Response:
    """Enhanced health check with Pub/Sub statistics (v9.0)."""
    settings: Settings = request.app["settings"]
    dedup: Deduper = request.app["dedup"]

    # 檢查 Firestore 連線
    db = request.app.get("db")
    firestore_ok = db is not None

    # 檢查 Redis 連線
    redis_ok = dedup.ping() if hasattr(dedup, "ping") else True

    return web.json_response({
        "ok": True,
        "version": "9.2",
        "service": "news-collector",
        "dependencies": {
            "firestore": firestore_ok,
            "redis": redis_ok,
            "pubsub": request.app["pub"].is_enabled,
        },
        "pubsub_stats": get_pubsub_stats(),
        "config": {
            "otel_enabled": settings.otel_enabled,
            "topic_news_raw": settings.topic_news_raw,
            "topic_audit_log": settings.topic_audit_log,
            "rss_feeds_configured": len(settings.rss_url_list()),
            "finnhub_configured": bool(settings.finnhub_api_key),
            "coingecko_enabled": settings.coingecko_enabled,
        },
    })


# ── App Factory ──────────────────────────────────────────────────

def create_app() -> web.Application:
    """Create the aiohttp application."""
    settings = Settings()

    # OTel 初始化（若啟用）
    if settings.otel_enabled:
        _init_otel(settings.otel_service_name)

    app = web.Application()
    app["settings"] = settings
    app["pub"] = PubSubPublisher(settings.gcp_project_id)
    app["dedup"] = Deduper(settings.redis_host, settings.redis_port)
    app["news_cache"] = NewsCache(settings.redis_host, settings.redis_port)

    # Firestore（optional）
    if FIRESTORE_AVAILABLE and settings.gcp_project_id:
        try:
            app["db"] = firestore.Client(project=settings.gcp_project_id)
            logger.info("[Firestore] Client initialized")
        except Exception as e:
            logger.warning(f"[Firestore] Init failed: {e}")
            app["db"] = None
    else:
        logger.warning("[Firestore] Not available or no project ID configured")
        app["db"] = None

    # 關閉時 flush Pub/Sub（確保訊息已交付）
    if settings.pubsub_flush_on_shutdown:
        async def on_shutdown(app: web.Application) -> None:
            pub: PubSubPublisher = app["pub"]
            if pub.is_enabled:
                logger.info("[Shutdown] Flushing pending Pub/Sub messages...")
                confirmed = await pub.flush_async(timeout=10.0)
                logger.info(f"[Shutdown] {confirmed} messages confirmed")

        app.on_shutdown.append(on_shutdown)

    app.router.add_post("/run", handle_run)
    app.router.add_get("/healthz", handle_health)

    return app


if __name__ == "__main__":
    import web as _web  # type: ignore
    logger.info("Starting news-collector v9.2")
    _web.run_app(create_app(), host="0.0.0.0", port=8080)
