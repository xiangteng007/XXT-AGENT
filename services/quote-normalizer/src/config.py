import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Configuration for quote-normalizer service."""
    
    gcp_project_id: str = Field(default_factory=lambda: os.getenv("GCP_PROJECT_ID", ""))
    topic_events_normalized: str = Field(default_factory=lambda: os.getenv("TOPIC_EVENTS_NORMALIZED", ""))

    redis_host: str = Field(default_factory=lambda: os.getenv("REDIS_HOST", "127.0.0.1"))
    redis_port: int = Field(default_factory=lambda: int(os.getenv("REDIS_PORT", "6379")))

    sql_host: str = Field(default_factory=lambda: os.getenv("SQL_HOST", ""))
    sql_db: str = Field(default_factory=lambda: os.getenv("SQL_DB", "ai_me_market"))
    sql_user: str = Field(default_factory=lambda: os.getenv("SQL_USER", "ai_me"))
    sql_password: str = Field(default_factory=lambda: os.getenv("SQL_PASSWORD", ""))

    candle_ttl_sec: int = Field(default_factory=lambda: int(os.getenv("CANDLE_TTL_SEC", "10800")))
    finalize_before_sec: int = Field(default_factory=lambda: int(os.getenv("FINALIZE_BEFORE_SEC", "120")))
