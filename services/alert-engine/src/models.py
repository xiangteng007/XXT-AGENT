"""
Data models for alert-engine service.
"""
from __future__ import annotations
from pydantic import BaseModel
from typing import Literal, List
from datetime import datetime


class Candle1mEvent(BaseModel):
    """Incoming 1-minute candle event from quote-normalizer."""
    schema_version: str
    event_type: Literal["candle_1m"]
    source: str

    symbol: str
    minute_ts_ms: int

    open: float
    high: float
    low: float
    close: float
    volume: float

    finalized_at: datetime


class FusedNewsItem(BaseModel):
    """News item within a fused event."""
    headline: str = ""
    url: str = ""
    source: str = ""
    summary: str = ""
    ts_unix: int = 0


class FusedEvent(BaseModel):
    """Fused event combining candle and news data from event-fusion-engine."""
    schema_version: str
    event_type: Literal["fused_event"]
    source: str

    symbol: str
    minute_ts_ms: int

    # Price data (may be nested or flat depending on source version)
    price_change_pct_1m: float = 0.0
    news_count_lookback: int = 0
    top_news: List[FusedNewsItem] = []

    severity: int = 0
    direction: Literal["positive", "negative", "mixed", "neutral"] = "neutral"
    fused_at: str = ""
