import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Service configuration from environment variables."""
    
    gcp_project_id: str = Field(default_factory=lambda: os.getenv("GCP_PROJECT_ID", ""))
    pubsub_topic_quotes_raw: str = Field(default_factory=lambda: os.getenv("PUBSUB_TOPIC_QUOTES_RAW", ""))
    pubsub_topic_news_raw: str = Field(default_factory=lambda: os.getenv("PUBSUB_TOPIC_NEWS_RAW", ""))
    pubsub_topic_social_raw: str = Field(default_factory=lambda: os.getenv("PUBSUB_TOPIC_SOCIAL_RAW", ""))

    finnhub_secret_name: str = Field(default_factory=lambda: os.getenv("FINNHUB_SECRET_NAME", ""))
    streamer_symbols: str = Field(default_factory=lambda: os.getenv("STREAMER_SYMBOLS", "AAPL,MSFT,SPY"))
    health_port: int = Field(default_factory=lambda: int(os.getenv("HEALTH_PORT", "8080")))

    # Runtime controls
    reconnect_min_delay_sec: float = 1.0
    reconnect_max_delay_sec: float = 30.0
    ping_interval_sec: float = 20.0

    def symbols_list(self) -> list[str]:
        """Parse comma-separated symbols into a list."""
        return [s.strip() for s in self.streamer_symbols.split(",") if s.strip()]
