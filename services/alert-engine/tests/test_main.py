"""
Alert Engine — Unit Tests

Tests for pubsub decode, candle change %, message formatting, models, and threshold logic.
"""
import pytest
import base64
import json
from datetime import datetime, timezone


# ─── Pub/Sub Decode ───────────────────────────

class TestPubsubDecode:
    def test_valid_message(self):
        from src.main import pubsub_decode
        payload = {"event_type": "candle_1m", "symbol": "AAPL"}
        encoded = base64.b64encode(json.dumps(payload).encode()).decode()
        result = pubsub_decode({"message": {"data": encoded}})
        assert result["event_type"] == "candle_1m"

    def test_empty(self):
        from src.main import pubsub_decode
        assert pubsub_decode({}) == {}
        assert pubsub_decode({"message": {}}) == {}
        assert pubsub_decode({"message": {"data": ""}}) == {}


# ─── Candle Change % ──────────────────────────

class TestCandleChangePct:
    def test_positive_change(self):
        from src.main import candle_change_pct
        from src.models import Candle1mEvent
        c = Candle1mEvent(
            schema_version="1.0", event_type="candle_1m", source="test",
            symbol="TSLA", minute_ts_ms=1700000000000,
            open=100.0, high=105.0, low=99.0, close=105.0,
            volume=1000, finalized_at=datetime.now(timezone.utc),
        )
        pct = candle_change_pct(c)
        assert pct == pytest.approx(5.0)

    def test_negative_change(self):
        from src.main import candle_change_pct
        from src.models import Candle1mEvent
        c = Candle1mEvent(
            schema_version="1.0", event_type="candle_1m", source="test",
            symbol="AAPL", minute_ts_ms=1700000000000,
            open=200.0, high=200.0, low=190.0, close=190.0,
            volume=500, finalized_at=datetime.now(timezone.utc),
        )
        pct = candle_change_pct(c)
        assert pct == pytest.approx(-5.0)

    def test_no_change(self):
        from src.main import candle_change_pct
        from src.models import Candle1mEvent
        c = Candle1mEvent(
            schema_version="1.0", event_type="candle_1m", source="test",
            symbol="GOOG", minute_ts_ms=1700000000000,
            open=150.0, high=150.0, low=150.0, close=150.0,
            volume=100, finalized_at=datetime.now(timezone.utc),
        )
        assert candle_change_pct(c) == 0.0

    def test_zero_open_returns_zero(self):
        from src.main import candle_change_pct
        from src.models import Candle1mEvent
        c = Candle1mEvent(
            schema_version="1.0", event_type="candle_1m", source="test",
            symbol="TEST", minute_ts_ms=1700000000000,
            open=0.0, high=1.0, low=0.0, close=1.0,
            volume=10, finalized_at=datetime.now(timezone.utc),
        )
        assert candle_change_pct(c) == 0.0


# ─── Message Formatting ──────────────────────

class TestFormatCandleMessage:
    def test_positive_format(self):
        from src.main import format_candle_message
        from src.models import Candle1mEvent
        c = Candle1mEvent(
            schema_version="1.0", event_type="candle_1m", source="test",
            symbol="TSLA", minute_ts_ms=1700000000000,
            open=200.0, high=210.0, low=199.0, close=208.0,
            volume=5000, finalized_at=datetime(2024, 1, 1, 12, 30, 0, tzinfo=timezone.utc),
        )
        msg = format_candle_message(c, 4.0)
        assert "TSLA" in msg
        assert "📈 上漲" in msg
        assert "+4.00%" in msg

    def test_negative_format(self):
        from src.main import format_candle_message
        from src.models import Candle1mEvent
        c = Candle1mEvent(
            schema_version="1.0", event_type="candle_1m", source="test",
            symbol="AAPL", minute_ts_ms=1700000000000,
            open=150.0, high=150.0, low=145.0, close=146.0,
            volume=3000, finalized_at=datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
        )
        msg = format_candle_message(c, -2.67)
        assert "📉 下跌" in msg
        assert "🔥" in msg  # abs > 2

    def test_small_change_warning_emoji(self):
        from src.main import format_candle_message
        from src.models import Candle1mEvent
        c = Candle1mEvent(
            schema_version="1.0", event_type="candle_1m", source="test",
            symbol="X", minute_ts_ms=0,
            open=100.0, high=101.0, low=99.0, close=101.0,
            volume=100, finalized_at=datetime.now(timezone.utc),
        )
        msg = format_candle_message(c, 1.0)
        assert "⚠️" in msg


class TestFormatFusedMessage:
    def test_positive_direction(self):
        from src.main import format_fused_message
        from src.models import FusedEvent, FusedNewsItem
        ev = FusedEvent(
            schema_version="1.0", event_type="fused_event", source="test",
            symbol="TSLA", minute_ts_ms=0,
            price_change_pct_1m=3.5, news_count_lookback=5,
            top_news=[FusedNewsItem(headline="Tesla hits new high", source="Reuters", url="https://x.com")],
            severity=75, direction="positive", fused_at="2024-01-01T12:00:00",
        )
        msg = format_fused_message(ev)
        assert "📈 利多" in msg
        assert "🟢" in msg
        assert "🔥🔥🔥" in msg  # severity >= 70
        assert "Tesla hits new high" in msg

    def test_negative_direction(self):
        from src.main import format_fused_message
        from src.models import FusedEvent
        ev = FusedEvent(
            schema_version="1.0", event_type="fused_event", source="test",
            symbol="AAPL", minute_ts_ms=0,
            severity=55, direction="negative", fused_at="2024-01-01T00:00:00",
        )
        msg = format_fused_message(ev)
        assert "📉 利空" in msg
        assert "🔴" in msg
        assert "🔥🔥" in msg  # severity 50-69

    def test_neutral_no_news(self):
        from src.main import format_fused_message
        from src.models import FusedEvent
        ev = FusedEvent(
            schema_version="1.0", event_type="fused_event", source="test",
            symbol="X", minute_ts_ms=0,
            severity=20, direction="neutral", fused_at="",
        )
        msg = format_fused_message(ev)
        assert "➡️ 中性" in msg
        assert "無可用新聞摘要" in msg


# ─── Models ───────────────────────────────────

class TestAlertModels:
    def test_candle_model(self):
        from src.models import Candle1mEvent
        c = Candle1mEvent(
            schema_version="1.0", event_type="candle_1m", source="test",
            symbol="TSLA", minute_ts_ms=1700000000000,
            open=200.0, high=210.0, low=195.0, close=205.0,
            volume=10000, finalized_at=datetime.now(timezone.utc),
        )
        assert c.event_type == "candle_1m"

    def test_fused_news_item(self):
        from src.models import FusedNewsItem
        n = FusedNewsItem(headline="Test", url="https://example.com", source="CNN")
        assert n.headline == "Test"
        assert n.ts_unix == 0

    def test_fused_event_defaults(self):
        from src.models import FusedEvent
        ev = FusedEvent(
            schema_version="1.0", event_type="fused_event", source="test",
            symbol="X", minute_ts_ms=0,
        )
        assert ev.severity == 0
        assert ev.direction == "neutral"
        assert ev.top_news == []
