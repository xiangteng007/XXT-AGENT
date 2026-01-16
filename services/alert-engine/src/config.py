"""
Configuration for alert-engine service.
"""
import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Configuration from environment variables."""
    
    redis_host: str = Field(default_factory=lambda: os.getenv("REDIS_HOST", "127.0.0.1"))
    redis_port: int = Field(default_factory=lambda: int(os.getenv("REDIS_PORT", "6379")))

    # Telegram
    telegram_bot_token: str = Field(default_factory=lambda: os.getenv("TELEGRAM_BOT_TOKEN", ""))
    telegram_chat_id: str = Field(default_factory=lambda: os.getenv("TELEGRAM_CHAT_ID", ""))

    # LINE
    line_channel_access_token: str = Field(default_factory=lambda: os.getenv("LINE_CHANNEL_ACCESS_TOKEN", ""))
    line_to: str = Field(default_factory=lambda: os.getenv("LINE_TO", ""))

    # LLM Alert Operator (optional)
    use_llm_alert_operator: bool = Field(default_factory=lambda: os.getenv("USE_LLM_ALERT_OPERATOR", "false").lower() == "true")
    gemini_api_key: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))

    # candle_1m alert thresholds
    default_alert_cooldown_sec: int = Field(default_factory=lambda: int(os.getenv("DEFAULT_ALERT_COOLDOWN_SEC", "180")))
    min_change_pct_to_alert: float = Field(default_factory=lambda: float(os.getenv("MIN_CHANGE_PCT_TO_ALERT", "0.9")))

    # fused_event alert thresholds
    min_fused_severity_to_alert: int = Field(
        default_factory=lambda: int(os.getenv("MIN_FUSED_SEVERITY_TO_ALERT", "35"))
    )
    fused_alert_cooldown_sec: int = Field(
        default_factory=lambda: int(os.getenv("FUSED_ALERT_COOLDOWN_SEC", "300"))
    )
