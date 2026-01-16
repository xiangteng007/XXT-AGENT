"""
Configuration for trade-planner-worker service.
"""
import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Configuration from environment variables."""
    
    gcp_project_id: str = Field(default_factory=lambda: os.getenv("GCP_PROJECT_ID", ""))
    
    redis_host: str = Field(default_factory=lambda: os.getenv("REDIS_HOST", "127.0.0.1"))
    redis_port: int = Field(default_factory=lambda: int(os.getenv("REDIS_PORT", "6379")))

    sql_host: str = Field(default_factory=lambda: os.getenv("SQL_HOST", ""))
    sql_db: str = Field(default_factory=lambda: os.getenv("SQL_DB", "ai_me_market"))
    sql_user: str = Field(default_factory=lambda: os.getenv("SQL_USER", "ai_me"))
    sql_password: str = Field(default_factory=lambda: os.getenv("SQL_PASSWORD", ""))

    gemini_api_key: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    gemini_model: str = Field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-1.5-pro"))

    news_lookback_sec: int = Field(default_factory=lambda: int(os.getenv("NEWS_LOOKBACK_SEC", "3600")))
    social_lookback_sec: int = Field(default_factory=lambda: int(os.getenv("SOCIAL_LOOKBACK_SEC", "3600")))
