"""
Data models for quote-normalizer service.
"""
from __future__ import annotations
from pydantic import BaseModel
from typing import Literal, Optional
from datetime import datetime


class Instrument(BaseModel):
    """Financial instrument identifier."""
    symbol: str
    asset_class: Literal["STOCK", "ETF", "FUTURES", "INDEX", "FX", "CRYPTO"] = "STOCK"
    exchange: Optional[str] = None
    currency: Optional[str] = None


class QuoteTradeEvent(BaseModel):
    """Incoming trade event from market-streamer."""
    schema_version: str
    event_type: Literal["trade"]
    source: str

    ingested_at: datetime
    ts_ms: int

    instrument: Instrument
    price: float
    volume: float = 0.0


class Candle1mEvent(BaseModel):
    """Outgoing 1-minute candle event."""
    schema_version: str = "1.0"
    event_type: Literal["candle_1m"] = "candle_1m"
    source: str = "quote-normalizer"

    symbol: str
    minute_ts_ms: int

    open: float
    high: float
    low: float
    close: float
    volume: float

    finalized_at: datetime
