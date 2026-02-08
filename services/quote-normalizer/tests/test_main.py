"""
Quote Normalizer — Unit Tests

Tests for pubsub decode, minute bucketing, models, and candle logic.
"""
import pytest
import base64
import json
from datetime import datetime, timezone


# ─── Pub/Sub Decode ───────────────────────────

class TestPubsubDecode:
    def test_valid_message(self):
        from src.main import pubsub_decode
        payload = {"key": "value"}
        encoded = base64.b64encode(json.dumps(payload).encode()).decode()
        result = pubsub_decode({"message": {"data": encoded}})
        assert result == payload

    def test_empty_data(self):
        from src.main import pubsub_decode
        assert pubsub_decode({"message": {"data": ""}}) == {}

    def test_missing_message(self):
        from src.main import pubsub_decode
        assert pubsub_decode({}) == {}

    def test_missing_data_key(self):
        from src.main import pubsub_decode
        assert pubsub_decode({"message": {}}) == {}

    def test_complex_payload(self):
        from src.main import pubsub_decode
        payload = {
            "event_type": "trade",
            "instrument": {"symbol": "AAPL"},
            "price": 150.5,
            "ts_ms": 1700000000000,
        }
        encoded = base64.b64encode(json.dumps(payload).encode()).decode()
        result = pubsub_decode({"message": {"data": encoded}})
        assert result["instrument"]["symbol"] == "AAPL"


# ─── Minute Bucketing ─────────────────────────

class TestMinuteBucket:
    def test_exact_minute(self):
        from src.main import minute_bucket_ms
        # Exactly on minute boundary
        assert minute_bucket_ms(60000) == 60000

    def test_mid_minute(self):
        from src.main import minute_bucket_ms
        # 30 seconds into a minute
        assert minute_bucket_ms(90000) == 60000

    def test_zero(self):
        from src.main import minute_bucket_ms
        assert minute_bucket_ms(0) == 0

    def test_realistic_timestamp(self):
        from src.main import minute_bucket_ms
        # 2024-01-01T00:00:30.000Z -> should round down to 00:00:00
        ts = 1704067230000  # 30s past midnight
        expected = 1704067200000  # midnight
        assert minute_bucket_ms(ts) == expected


# ─── Models ───────────────────────────────────

class TestQuoteNormalizerModels:
    def test_candle1m_event(self):
        from src.models import Candle1mEvent
        c = Candle1mEvent(
            symbol="TSLA",
            minute_ts_ms=1700000000000,
            open=240.0,
            high=245.0,
            low=238.0,
            close=243.0,
            volume=50000,
            finalized_at=datetime.now(timezone.utc),
        )
        assert c.event_type == "candle_1m"
        assert c.schema_version == "1.0"
        assert c.high > c.low

    def test_candle_serialization(self):
        from src.models import Candle1mEvent
        c = Candle1mEvent(
            symbol="AAPL",
            minute_ts_ms=1700000000000,
            open=150.0, high=151.0, low=149.0, close=150.5,
            volume=10000,
            finalized_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        )
        d = c.model_dump(mode="json")
        assert d["symbol"] == "AAPL"
        assert d["event_type"] == "candle_1m"

    def test_quote_trade_event(self):
        from src.models import QuoteTradeEvent
        ev = QuoteTradeEvent(
            schema_version="1.0",
            event_type="trade",
            source="finnhub",
            ingested_at=datetime.now(timezone.utc),
            ts_ms=1700000000000,
            instrument={"symbol": "GOOG"},
            price=142.5,
        )
        assert ev.event_type == "trade"
