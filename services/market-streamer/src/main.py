"""
AI ME Market Streamer — Main Entry Point

WebSocket real-time quote receiver that:
1. Connects to Finnhub WebSocket (with auto-reconnect)
2. Publishes normalized trade events to Pub/Sub
3. Sends periodic heartbeats
4. Exposes health check endpoint
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from google.cloud import secretmanager

from .config import Settings
from .pubsub import PubSubPublisher
from .provider_finnhub import FinnhubWS
from .health import create_health_app
from .models import HeartbeatEvent
from .util_backoff import exp_backoff_delay


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

logger = logging.getLogger("market-streamer")


def read_secret_value(project_id: str, secret_id: str) -> str:
    """Read secret value from GCP Secret Manager."""
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    resp = client.access_secret_version(request={"name": name})
    return resp.payload.data.decode("utf-8")


async def run_health_server(port: int) -> None:
    """Start the health check HTTP server."""
    from aiohttp import web
    app = create_health_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logger.info(f"Health server listening on :{port}")


async def run_streamer_loop(settings: Settings) -> None:
    """
    Main streamer loop with auto-reconnect.
    
    Connects to Finnhub WebSocket, publishes events to Pub/Sub,
    and reconnects with exponential backoff on failures.
    """
    if not settings.gcp_project_id:
        raise RuntimeError("Missing GCP_PROJECT_ID")
    if not settings.pubsub_topic_quotes_raw:
        raise RuntimeError("Missing PUBSUB_TOPIC_QUOTES_RAW")
    if not settings.finnhub_secret_name:
        raise RuntimeError("Missing FINNHUB_SECRET_NAME (Secret ID)")

    symbols = settings.symbols_list()
    logger.info(f"Tracking symbols: {symbols}")

    # Read API key from Secret Manager
    api_key = read_secret_value(settings.gcp_project_id, settings.finnhub_secret_name)
    logger.info("API key loaded from Secret Manager")

    pub = PubSubPublisher(project_id=settings.gcp_project_id)
    provider = FinnhubWS(
        api_key=api_key, 
        symbols=symbols, 
        ping_interval_sec=settings.ping_interval_sec
    )

    attempt = 0
    event_count = 0

    while True:
        try:
            attempt = 0
            logger.info("Connecting to Finnhub WebSocket...")
            
            async for ev in provider.connect_and_stream():
                pub.publish_json(settings.pubsub_topic_quotes_raw, ev.model_dump(mode="json"))
                event_count += 1
                
                if event_count % 1000 == 0:
                    logger.info(f"Published {event_count} events")
                    
        except Exception as e:
            attempt += 1
            delay = exp_backoff_delay(
                attempt, 
                settings.reconnect_min_delay_sec, 
                settings.reconnect_max_delay_sec
            )
            logger.exception(f"Streamer error, reconnecting in {delay:.1f}s: {e}")
            await asyncio.sleep(delay)


async def heartbeat_task(settings: Settings) -> None:
    """Periodic heartbeat to confirm streamer is alive."""
    if not settings.gcp_project_id or not settings.pubsub_topic_quotes_raw:
        return
        
    pub = PubSubPublisher(project_id=settings.gcp_project_id)

    while True:
        hb = HeartbeatEvent(
            ingested_at=datetime.now(timezone.utc),
            message="market-streamer alive",
        )
        pub.publish_json(settings.pubsub_topic_quotes_raw, hb.model_dump(mode="json"))
        logger.debug("Heartbeat sent")
        await asyncio.sleep(60)


async def main() -> None:
    """Main entry point — run all tasks concurrently."""
    settings = Settings()

    logger.info("Starting AI ME Market Streamer")
    logger.info(f"Project: {settings.gcp_project_id}")
    logger.info(f"Symbols: {settings.streamer_symbols}")

    await asyncio.gather(
        run_health_server(settings.health_port),
        run_streamer_loop(settings),
        heartbeat_task(settings),
    )


if __name__ == "__main__":
    asyncio.run(main())
