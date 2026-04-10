"""
Investment Brain — Configuration
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    """Immutable application settings loaded from environment."""

    # ── Service URLs ──────────────────────────────────────
    ai_gateway_url: str = field(
        default_factory=lambda: os.getenv("AI_GATEWAY_URL", "http://localhost:8080")
    )
    ai_gateway_api_key: str = field(
        default_factory=lambda: os.getenv("AI_GATEWAY_API_KEY", "")
    )
    fusion_engine_url: str = field(
        default_factory=lambda: os.getenv("FUSION_ENGINE_URL", "http://localhost:8080")
    )
    trade_planner_url: str = field(
        default_factory=lambda: os.getenv("TRADE_PLANNER_URL", "http://localhost:8080")
    )
    openclaw_gateway_url: str = field(
        default_factory=lambda: os.getenv("OPENCLAW_GATEWAY_URL", "http://localhost:3100")
    )
    simulation_engine_url: str = field(
        default_factory=lambda: os.getenv("SIMULATION_ENGINE_URL", "http://localhost:8091")
    )

    # ── Redis ─────────────────────────────────────────────
    redis_url: str = field(
        default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379")
    )

    # ── Google AI (direct fallback) ───────────────────────
    google_ai_api_key: str = field(
        default_factory=lambda: os.getenv("GOOGLE_AI_API_KEY", "")
    )

    # ── Risk Management Hard Limits ──────────────────────
    max_single_position_pct: float = field(
        default_factory=lambda: float(os.getenv("MAX_SINGLE_POSITION_PCT", "20"))
    )
    max_daily_loss_pct: float = field(
        default_factory=lambda: float(os.getenv("MAX_DAILY_LOSS_PCT", "5"))
    )
    max_drawdown_pct: float = field(
        default_factory=lambda: float(os.getenv("MAX_DRAWDOWN_PCT", "15"))
    )
    default_risk_level: str = field(
        default_factory=lambda: os.getenv("DEFAULT_RISK_LEVEL", "moderate")
    )

    # ── Service Config ────────────────────────────────────
    port: int = field(
        default_factory=lambda: int(os.getenv("PORT", "8090"))
    )
    log_level: str = field(
        default_factory=lambda: os.getenv("LOG_LEVEL", "INFO")
    )


# Singleton
settings = Settings()
