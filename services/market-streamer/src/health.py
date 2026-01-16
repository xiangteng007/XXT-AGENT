"""
Simple HTTP health check server for container probes.
"""
from __future__ import annotations
from aiohttp import web


async def health_handler(request: web.Request) -> web.Response:
    """Health check endpoint for GCE/GKE probes."""
    return web.json_response({"ok": True})


def create_health_app() -> web.Application:
    """Create aiohttp application with health check route."""
    app = web.Application()
    app.router.add_get("/healthz", health_handler)
    app.router.add_get("/", health_handler)  # Root path for simple checks
    return app
