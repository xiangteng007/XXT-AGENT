"""
Configuration for news-collector service.
"""
import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Configuration from environment variables."""
    
    gcp_project_id: str = Field(default_factory=lambda: os.getenv("GCP_PROJECT_ID", ""))
    topic_news_raw: str = Field(default_factory=lambda: os.getenv("TOPIC_NEWS_RAW", ""))

    redis_host: str = Field(default_factory=lambda: os.getenv("REDIS_HOST", "127.0.0.1"))
    redis_port: int = Field(default_factory=lambda: int(os.getenv("REDIS_PORT", "6379")))

    finnhub_api_key: str = Field(default_factory=lambda: os.getenv("FINNHUB_API_KEY", ""))
    rss_urls: str = Field(default_factory=lambda: os.getenv("RSS_URLS", ""))

    # Deduplication TTL (24 hours default)
    dedup_ttl_sec: int = Field(default=86400)
    
    def rss_url_list(self) -> list[str]:
        """Parse comma-separated RSS URLs into a list."""
        return [u.strip() for u in self.rss_urls.split(",") if u.strip()]
