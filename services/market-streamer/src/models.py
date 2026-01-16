"""
Event data contracts — all downstream workers consume these schemas.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime


class Instrument(BaseModel):
    """Financial instrument identifier."""
    symbol: str
    asset_class: Literal["STOCK", "ETF", "FUTURES", "INDEX", "FX", "CRYPTO"] = "STOCK"
    exchange: Optional[str] = None
    currency: Optional[str] = None


class QuoteTradeEvent(BaseModel):
    """Normalized trade event from market data providers."""
    schema_version: str = "1.0"
    event_type: Literal["trade"] = "trade"
    source: str = "finnhub"

    ingested_at: datetime
    ts_ms: int

    instrument: Instrument
    price: float
    volume: float = Field(default=0)
    conditions: Optional[list[str]] = None


class HeartbeatEvent(BaseModel):
    """Periodic heartbeat to confirm streamer is alive."""
    schema_version: str = "1.0"
    event_type: Literal["heartbeat"] = "heartbeat"
    source: str = "market-streamer"

    ingested_at: datetime
    message: str = "ok"
