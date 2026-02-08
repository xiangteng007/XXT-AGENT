"""
Market Streamer — Unit Tests

Tests for Pydantic models, backoff utility, config, and health endpoint.
"""
import pytest
from datetime import datetime, timezone


# ─── Models ───────────────────────────────────

class TestInstrumentModel:
    def test_defaults(self):
        from src.models import Instrument
        inst = Instrument(symbol="AAPL")
        assert inst.symbol == "AAPL"
        assert inst.asset_class == "STOCK"
        assert inst.exchange is None
        assert inst.currency is None

    def test_all_asset_classes(self):
        from src.models import Instrument
        for ac in ("STOCK", "ETF", "FUTURES", "INDEX", "FX", "CRYPTO"):
            inst = Instrument(symbol="X", asset_class=ac)
            assert inst.asset_class == ac

    def test_invalid_asset_class(self):
        from src.models import Instrument
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            Instrument(symbol="X", asset_class="INVALID")


class TestQuoteTradeEvent:
    def test_valid_trade(self):
        from src.models import QuoteTradeEvent, Instrument
        ev = QuoteTradeEvent(
            ingested_at=datetime.now(timezone.utc),
            ts_ms=1700000000000,
            instrument=Instrument(symbol="TSLA"),
            price=245.50,
            volume=1000,
        )
        assert ev.event_type == "trade"
        assert ev.schema_version == "1.0"
        assert ev.source == "finnhub"
        assert ev.instrument.symbol == "TSLA"

    def test_volume_default_zero(self):
        from src.models import QuoteTradeEvent, Instrument
        ev = QuoteTradeEvent(
            ingested_at=datetime.now(timezone.utc),
            ts_ms=1700000000000,
            instrument=Instrument(symbol="AAPL"),
            price=100.0,
        )
        assert ev.volume == 0

    def test_conditions_optional(self):
        from src.models import QuoteTradeEvent, Instrument
        ev = QuoteTradeEvent(
            ingested_at=datetime.now(timezone.utc),
            ts_ms=1700000000000,
            instrument=Instrument(symbol="GOOG"),
            price=150.0,
            conditions=["@", "T"],
        )
        assert ev.conditions == ["@", "T"]

    def test_serialization(self):
        from src.models import QuoteTradeEvent, Instrument
        ev = QuoteTradeEvent(
            ingested_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            ts_ms=1700000000000,
            instrument=Instrument(symbol="MSFT"),
            price=300.0,
        )
        d = ev.model_dump(mode="json")
        assert d["event_type"] == "trade"
        assert d["instrument"]["symbol"] == "MSFT"


class TestHeartbeatEvent:
    def test_defaults(self):
        from src.models import HeartbeatEvent
        hb = HeartbeatEvent(ingested_at=datetime.now(timezone.utc))
        assert hb.event_type == "heartbeat"
        assert hb.source == "market-streamer"
        assert hb.message == "ok"

    def test_custom_message(self):
        from src.models import HeartbeatEvent
        hb = HeartbeatEvent(
            ingested_at=datetime.now(timezone.utc),
            message="market-streamer alive",
        )
        assert hb.message == "market-streamer alive"


# ─── Backoff Utility ──────────────────────────

class TestExpBackoffDelay:
    def test_first_attempt(self):
        from src.util_backoff import exp_backoff_delay
        delay = exp_backoff_delay(1, min_delay=1.0, max_delay=60.0)
        assert 1.0 <= delay <= 1.25  # base=1 + jitter up to 25%

    def test_exponential_growth(self):
        from src.util_backoff import exp_backoff_delay
        d1 = exp_backoff_delay(1, 1.0, 60.0)
        d3 = exp_backoff_delay(3, 1.0, 60.0)
        assert d3 > d1

    def test_max_delay_cap(self):
        from src.util_backoff import exp_backoff_delay
        delay = exp_backoff_delay(100, 1.0, 30.0)
        assert delay <= 30.0

    def test_zero_attempt(self):
        from src.util_backoff import exp_backoff_delay
        delay = exp_backoff_delay(0, 1.0, 60.0)
        assert delay >= 0


# ─── Config ───────────────────────────────────

class TestSettings:
    def test_defaults(self, monkeypatch):
        from src.config import Settings
        monkeypatch.setenv("GCP_PROJECT_ID", "test-project")
        s = Settings()
        assert s.health_port == 8080

    def test_symbols_list(self, monkeypatch):
        from src.config import Settings
        monkeypatch.setenv("GCP_PROJECT_ID", "test")
        monkeypatch.setenv("STREAMER_SYMBOLS", "AAPL,TSLA,GOOG")
        s = Settings()
        symbols = s.symbols_list()
        assert symbols == ["AAPL", "TSLA", "GOOG"]
