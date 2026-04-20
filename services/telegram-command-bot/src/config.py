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

    # NemoClaw Layer 4: Regulation RAG
    regulation_rag_url: str = Field(default_factory=lambda: os.getenv("REGULATION_RAG_URL", "http://localhost:8092"))
    # NemoClaw Layer 1: Ollama direct access
    ollama_base_url: str = Field(default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
    ollama_model: str = Field(default_factory=lambda: os.getenv("OLLAMA_L1_MODEL", "qwen3:14b"))
    # OpenClaw Gateway
    openclaw_gateway_url: str = Field(default_factory=lambda: os.getenv("OPENCLAW_GATEWAY_URL", "http://localhost:3100"))
    internal_secret: str = Field(default_factory=lambda: os.getenv("INTERNAL_SECRET", ""))
