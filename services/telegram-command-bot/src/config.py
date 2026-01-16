"""
Configuration for telegram-command-bot service.
"""
import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Configuration from environment variables."""
    
    redis_host: str = Field(default_factory=lambda: os.getenv("REDIS_HOST", "127.0.0.1"))
    redis_port: int = Field(default_factory=lambda: int(os.getenv("REDIS_PORT", "6379")))

    telegram_bot_token: str = Field(default_factory=lambda: os.getenv("TELEGRAM_BOT_TOKEN", ""))
    telegram_webhook_secret_token: str = Field(default_factory=lambda: os.getenv("TELEGRAM_WEBHOOK_SECRET_TOKEN", ""))

    trade_planner_url: str = Field(default_factory=lambda: os.getenv("TRADE_PLANNER_URL", ""))
