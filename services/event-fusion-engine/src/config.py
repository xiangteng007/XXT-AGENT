"""
Configuration for event-fusion-engine service.
"""
import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Configuration from environment variables."""
    
    gcp_project_id: str = Field(default_factory=lambda: os.getenv("GCP_PROJECT_ID", ""))
    topic_events_normalized: str = Field(default_factory=lambda: os.getenv("TOPIC_EVENTS_NORMALIZED", ""))

    redis_host: str = Field(default_factory=lambda: os.getenv("REDIS_HOST", "127.0.0.1"))
    redis_port: int = Field(default_factory=lambda: int(os.getenv("REDIS_PORT", "6379")))

    watch_symbols: str = Field(default_factory=lambda: os.getenv("WATCH_SYMBOLS", ""))
    news_lookback_sec: int = Field(default_factory=lambda: int(os.getenv("NEWS_LOOKBACK_SEC", "1800")))
    social_lookback_sec: int = Field(default_factory=lambda: int(os.getenv("SOCIAL_LOOKBACK_SEC", "3600")))

    def watchlist(self) -> set[str]:
        """Parse comma-separated watch symbols into a set."""
        return {s.strip().upper() for s in self.watch_symbols.split(",") if s.strip()}
