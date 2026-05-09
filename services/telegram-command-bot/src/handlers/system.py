"""
handlers/system.py — System status & GPU monitoring handler (v9.2)

Handles /system command:
- Ollama inference engine status (local RTX 4080)
- GPU VRAM usage via Ollama /api/ps (loaded models)
- Redis / Pub/Sub connectivity
- Cloud Run service health
"""
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..config import Settings

from ..tg_api import send_message

logger = logging.getLogger("telegram-command-bot.system")


async def _check_ollama(base_url: str) -> dict:
    """Probe Ollama API health endpoint."""
    try:
        from aiohttp import ClientSession, ClientTimeout
        timeout = ClientTimeout(total=8)
        async with ClientSession(timeout=timeout) as session:
            async with session.get(f"{base_url}/api/tags") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    return {"ok": True, "models": models[:5]}
                return {"ok": False, "status": resp.status}
    except Exception as e:
        return {"ok": False, "error": str(e)[:80]}


async def _check_gpu(base_url: str) -> dict:
    """Query Ollama /api/ps for loaded models and VRAM usage."""
    if not base_url:
        return {"ok": False, "error": "not configured"}
    try:
        from aiohttp import ClientSession, ClientTimeout
        timeout = ClientTimeout(total=8)
        async with ClientSession(timeout=timeout) as session:
            async with session.get(f"{base_url}/api/ps") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    running = data.get("models", [])
                    total_vram_mb = 0
                    model_info = []
                    for m in running:
                        name = m.get("name", "?")
                        vram_bytes = m.get("size_vram", 0)
                        vram_mb = round(vram_bytes / 1024 / 1024)
                        total_vram_mb += vram_mb
                        model_info.append(f"{name} ({vram_mb}MB)")
                    return {
                        "ok": True,
                        "loaded_models": model_info,
                        "total_vram_mb": total_vram_mb,
                        "count": len(running),
                    }
                return {"ok": False, "status": resp.status}
    except Exception as e:
        return {"ok": False, "error": str(e)[:80]}


async def _check_gateway(gateway_url: str, internal_secret: str) -> dict:
    """Probe OpenClaw Gateway health."""
    if not gateway_url:
        return {"ok": False, "error": "not configured"}
    try:
        from aiohttp import ClientSession, ClientTimeout
        timeout = ClientTimeout(total=8)
        async with ClientSession(timeout=timeout) as session:
            async with session.get(
                f"{gateway_url}/healthz",
                headers={"Authorization": f"Bearer {internal_secret}"},
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return {"ok": True, "version": data.get("version", "?"), "uptime": data.get("uptime", "?")}
                return {"ok": False, "status": resp.status}
    except Exception as e:
        return {"ok": False, "error": str(e)[:80]}


async def _check_redis(host: str, port: int = 6379) -> dict:
    """Probe Redis connectivity."""
    if not host:
        return {"ok": False, "error": "not configured"}
    try:
        import redis as _redis
        r = _redis.Redis(host=host, port=port, socket_timeout=3, decode_responses=True)
        r.ping()
        info = r.info("memory")
        used_mb = info.get("used_memory", 0) / 1024 / 1024
        return {"ok": True, "used_mb": round(used_mb, 1)}
    except Exception as e:
        return {"ok": False, "error": str(e)[:80]}


def _icon(ok: bool) -> str:
    return "🟢" if ok else "🔴"


async def handle_system(
    args: list[str],
    chat_id: int | str,
    settings: "Settings",
) -> None:
    """
    /system — System status dashboard.
    Shows Ollama, GPU, Gateway, Redis, and config summary.
    """
    await send_message(
        settings.telegram_bot_token, chat_id,
        "⚙️ <b>系統狀態</b>\n正在探測各服務...",
        parse_mode="HTML"
    )

    # Parallel probes
    ollama_url = getattr(settings, "ollama_base_url", "")
    redis_host = getattr(settings, "redis_host", "")
    redis_port = getattr(settings, "redis_port", 6379)
    gateway_url = getattr(settings, "openclaw_gateway_url", "")
    internal_secret = getattr(settings, "internal_secret", "")

    ollama_r, gpu_r, gateway_r, redis_r = await asyncio.gather(
        _check_ollama(ollama_url),
        _check_gpu(ollama_url),
        _check_gateway(gateway_url, internal_secret),
        _check_redis(redis_host, redis_port),
        return_exceptions=False,
    )

    # ── Ollama ─────────────────────────────────────────────────
    if ollama_r.get("ok"):
        model_list = ", ".join(ollama_r.get("models", [])) or "（無模型）"
        ollama_line = f"{_icon(True)} Ollama | 模型: {model_list}"
    else:
        err = ollama_r.get("error") or f"HTTP {ollama_r.get('status', '?')}"
        ollama_line = f"{_icon(False)} Ollama | {err}"

    # ── GPU / VRAM ─────────────────────────────────────────────
    if gpu_r.get("ok"):
        loaded = gpu_r.get("loaded_models", [])
        vram = gpu_r.get("total_vram_mb", 0)
        if loaded:
            gpu_line = f"{_icon(True)} GPU | VRAM: {vram}MB | 載入: {', '.join(loaded)}"
        else:
            gpu_line = f"{_icon(True)} GPU | VRAM: 閒置（無載入模型）"
    else:
        err = gpu_r.get("error") or "unavailable"
        gpu_line = f"{_icon(False)} GPU | {err}"

    # ── Gateway ────────────────────────────────────────────────
    if gateway_r.get("ok"):
        gateway_line = (
            f"{_icon(True)} OpenClaw Gateway "
            f"v{gateway_r.get('version', '?')}"
        )
    else:
        err = gateway_r.get("error") or f"HTTP {gateway_r.get('status', '?')}"
        gateway_line = f"{_icon(False)} OpenClaw Gateway | {err}"

    # ── Redis ──────────────────────────────────────────────────
    if redis_r.get("ok"):
        redis_line = f"{_icon(True)} Redis | {redis_r.get('used_mb', 0)} MB used"
    else:
        err = redis_r.get("error") or "unreachable"
        redis_line = f"{_icon(False)} Redis | {err}"

    # ── Config summary ─────────────────────────────────────────
    reg_url = getattr(settings, "regulation_rag_url", "")
    otel_on = getattr(settings, "otel_enabled", False)

    msg = (
        "⚙️ <b>XXT-AGENT 系統狀態</b>\n"
        "━━━━━━━━━━━━━━━\n\n"
        f"<b>🤖 AI 推理引擎</b>\n"
        f"  {ollama_line}\n"
        f"  {gpu_line}\n\n"
        f"<b>🌐 後端服務</b>\n"
        f"  {gateway_line}\n"
        f"  {_icon(bool(reg_url))} Regulation RAG | "
        f"{'已設定' if reg_url else '⚠️ 未設定 REGULATION_RAG_URL'}\n\n"
        f"<b>💾 資料層</b>\n"
        f"  {redis_line}\n\n"
        f"<b>🔭 可觀測性</b>\n"
        f"  {_icon(otel_on)} OpenTelemetry: {'啟用' if otel_on else '停用'}\n\n"
        f"━━━━━━━━━━━━━━━\n"
        f"<i>版本: XXT-AGENT v9.2</i>"
    )

    await send_message(settings.telegram_bot_token, chat_id, msg, parse_mode="HTML")
