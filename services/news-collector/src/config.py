"""
Configuration for news-collector service — v9.0
"""
import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Configuration from environment variables."""

    # ── GCP 核心 ─────────────────────────────────────────────────
    gcp_project_id: str = Field(default_factory=lambda: os.getenv("GCP_PROJECT_ID", ""))
    topic_news_raw: str = Field(default_factory=lambda: os.getenv("TOPIC_NEWS_RAW", "news.raw"))
    topic_audit_log: str = Field(default_factory=lambda: os.getenv("TOPIC_AUDIT_LOG", "audit.log"))

    # ── Redis 去重 ────────────────────────────────────────────────
    redis_host: str = Field(default_factory=lambda: os.getenv("REDIS_HOST", "127.0.0.1"))
    redis_port: int = Field(default_factory=lambda: int(os.getenv("REDIS_PORT", "6379")))

    # ── 外部 API ──────────────────────────────────────────────────
    finnhub_api_key: str = Field(default_factory=lambda: os.getenv("FINNHUB_API_KEY", ""))
    rss_urls: str = Field(default_factory=lambda: os.getenv("RSS_URLS", ""))

    # ── CoinGecko（免費 API，無需 Key）────────────────────────────
    coingecko_enabled: bool = Field(default_factory=lambda: os.getenv("COINGECKO_ENABLED", "").lower() == "true")
    max_coingecko_trending: int = Field(default=7)     # 熱門幣種數量
    max_coingecko_movers: int = Field(default=10)      # 漲跌幅排行數量

    # ── 行為控制 ──────────────────────────────────────────────────
    dedup_ttl_sec: int = Field(default=86400)           # 24 小時去重窗口
    max_finnhub_items: int = Field(default=100)         # 每次 Finnhub 最多處理數
    max_rss_items: int = Field(default=200)             # 每次 RSS 最多處理數
    max_items_per_feed: int = Field(default=50)         # 每個 RSS feed 上限

    # ── OpenTelemetry ─────────────────────────────────────────────
    otel_enabled: bool = Field(default_factory=lambda: os.getenv("OTEL_ENABLED", "").lower() == "true")
    otel_service_name: str = Field(default="news-collector")

    # ── Pub/Sub 批量確認 ──────────────────────────────────────────
    pubsub_flush_on_shutdown: bool = Field(default=True)  # 關閉時等待 Pub/Sub 確認

    def rss_url_list(self) -> list[str]:
        """Parse comma-separated RSS URLs into a list."""
        return [u.strip() for u in self.rss_urls.split(",") if u.strip()]

    @property
    def audit_enabled(self) -> bool:
        """稽核日誌 topic 啟用條件。"""
        return bool(self.gcp_project_id and self.topic_audit_log)
