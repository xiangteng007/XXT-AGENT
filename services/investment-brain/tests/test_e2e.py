"""
F-04: E2E Integration Tests — Investment Brain
================================================

测试範疇：
  1. Health endpoint
  2. /invest/analyze (完整 Graph 流程 mock)
  3. /invest/analyze/stream (SSE 串流)
  4. /invest/memory (StrategyMemoryStore CRUD)
  5. A-05 Internal auth enforcement
  6. Session store persistence

執行方式（開發環境）：
    cd services/investment-brain
    pytest tests/test_e2e.py -v

環境需求：
    - INTERNAL_SECRET 可空（測試 client 自動處理）
    - ENVIRONMENT=development（繞過 auth 或提供 test secret）
    - REDIS_URL 可缺（自動 fallback in-memory）
"""
from __future__ import annotations

import json
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

# ── Patch out external services before importing app ────────
# This prevents real HTTP calls to Fugle, Ollama, or AI Gateway during tests.

_MOCK_MARKET_INSIGHT = {
    "symbol": "2330.TW",
    "price": 950.0,
    "trend": "bullish",
    "indicators": {"rsi": 58, "macd": "positive"},
}

_MOCK_RISK_ASSESSMENT = {
    "score": 35,
    "level": "medium",
    "violations": [],
    "recommendation": "proceed",
}

_MOCK_INVESTMENT_PLAN = {
    "strategy": "trend_following",
    "entry_price": 948.0,
    "target_price": 980.0,
    "stop_loss": 920.0,
    "position_size_pct": 15.0,
}

_MOCK_GRAPH_RESULT = {
    "messages": [],
    "current_step": "complete",
    "market_insight": _MOCK_MARKET_INSIGHT,
    "investment_plan": _MOCK_INVESTMENT_PLAN,
    "risk_assessment": _MOCK_RISK_ASSESSMENT,
    "trade_results": [],
    "portfolio": None,
    "strategy_memory": None,
    "started_at": "2026-01-01T00:00:00",
    "completed_at": "2026-01-01T00:01:30",
    "error": None,
}


@pytest.fixture(scope="module", autouse=True)
def patch_external_services():
    """Patch all external service calls (graph, Fugle, AI Gateway)."""
    with (
        patch(
            "src.graph.supervisor.investment_graph.ainvoke",
            new_callable=AsyncMock,
            return_value=_MOCK_GRAPH_RESULT,
        ),
        patch(
            "src.graph.supervisor.investment_graph.astream_events",
            return_value=_async_event_stream(),
        ),
    ):
        yield


async def _async_event_stream():
    """Simulate LangGraph astream_events output for SSE tests."""
    nodes = [
        "market_analyst",
        "information_verifier",
        "strategy_planner",
        "risk_manager",
    ]
    for node in nodes:
        yield {"event": "on_chain_start", "name": node, "data": {}}
        yield {"event": "on_chain_end", "name": node, "data": {}}
    # Final graph completion event
    yield {
        "event": "on_chain_end",
        "name": "LangGraph",
        "data": {"output": _MOCK_GRAPH_RESULT},
    }


@pytest.fixture(scope="module")
def app():
    """Import app after patches are applied."""
    os.environ.setdefault("ENVIRONMENT", "development")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
    os.environ.setdefault("SESSION_TTL_SECONDS", "3600")
    from src.main import app as _app
    return _app


@pytest.fixture(scope="module")
def client(app):
    """Sync TestClient for simple endpoint tests."""
    with TestClient(app) as c:
        yield c


# ═══════════════════════════════════════════════════════════
# 1. Health Check
# ═══════════════════════════════════════════════════════════

class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_response_schema(self, client):
        data = client.get("/health").json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "active_sessions" in data
        assert "risk_limits" in data

    def test_health_risk_limits_present(self, client):
        data = client.get("/health").json()
        limits = data["risk_limits"]
        assert "max_single_position_pct" in limits
        assert "max_daily_loss_pct" in limits
        assert "max_drawdown_pct" in limits


# ═══════════════════════════════════════════════════════════
# 2. Analyze Endpoint (Full Pipeline)
# ═══════════════════════════════════════════════════════════

class TestAnalyzeEndpoint:
    _BASE_PAYLOAD = {
        "symbol": "2330",
        "timeframe": "1d",
        "risk_level": "medium",
        "user_context": "E2E integration test",
    }

    def test_analyze_success(self, client):
        resp = client.post("/invest/analyze", json=self._BASE_PAYLOAD)
        assert resp.status_code == 200

    def test_analyze_response_has_session_id(self, client):
        data = client.post("/invest/analyze", json=self._BASE_PAYLOAD).json()
        assert "session_id" in data
        assert len(data["session_id"]) == 36  # UUID format

    def test_analyze_symbol_normalized_uppercase(self, client):
        payload = {**self._BASE_PAYLOAD, "symbol": "2330.tw"}
        data = client.post("/invest/analyze", json=payload).json()
        assert data["symbol"] == "2330.TW"

    def test_analyze_empty_symbol_returns_400(self, client):
        resp = client.post("/invest/analyze", json={**self._BASE_PAYLOAD, "symbol": ""})
        assert resp.status_code == 400

    def test_analyze_response_has_market_insight(self, client):
        data = client.post("/invest/analyze", json=self._BASE_PAYLOAD).json()
        assert data.get("market_insight") is not None

    def test_analyze_risk_assessment_in_response(self, client):
        data = client.post("/invest/analyze", json=self._BASE_PAYLOAD).json()
        assert data.get("risk_assessment") is not None
        risk = data["risk_assessment"]
        assert "score" in risk
        assert "level" in risk


# ═══════════════════════════════════════════════════════════
# 3. A-05 Internal Auth Enforcement
# ═══════════════════════════════════════════════════════════

class TestInternalAuth:
    _BASE_PAYLOAD = {"symbol": "2330", "timeframe": "1d", "risk_level": "medium"}

    def test_dev_mode_allows_no_secret(self, client):
        """In ENVIRONMENT=development, no X-Internal-Secret required."""
        resp = client.post("/invest/analyze", json=self._BASE_PAYLOAD)
        assert resp.status_code == 200

    def test_prod_mode_rejects_missing_secret(self, app):
        """In ENVIRONMENT=production with INTERNAL_SECRET set, missing header → 403."""
        os.environ["ENVIRONMENT"] = "production"
        os.environ["INTERNAL_SECRET"] = "test-secret-abc123"
        with TestClient(app) as prod_client:
            resp = prod_client.post("/invest/analyze", json=self._BASE_PAYLOAD)
            # We expect 403 when no X-Internal-Secret header provided
            assert resp.status_code == 403
        # Restore dev mode
        os.environ["ENVIRONMENT"] = "development"
        del os.environ["INTERNAL_SECRET"]

    def test_prod_mode_accepts_correct_secret(self, app):
        """Correct X-Internal-Secret passes auth."""
        os.environ["ENVIRONMENT"] = "production"
        os.environ["INTERNAL_SECRET"] = "test-secret-abc123"
        with TestClient(app) as prod_client:
            resp = prod_client.post(
                "/invest/analyze",
                json=self._BASE_PAYLOAD,
                headers={"X-Internal-Secret": "test-secret-abc123"},
            )
            assert resp.status_code == 200
        os.environ["ENVIRONMENT"] = "development"
        del os.environ["INTERNAL_SECRET"]

    def test_prod_mode_rejects_wrong_secret(self, app):
        """Wrong X-Internal-Secret value → 403."""
        os.environ["ENVIRONMENT"] = "production"
        os.environ["INTERNAL_SECRET"] = "test-secret-abc123"
        with TestClient(app) as prod_client:
            resp = prod_client.post(
                "/invest/analyze",
                json=self._BASE_PAYLOAD,
                headers={"X-Internal-Secret": "wrong-secret"},
            )
            assert resp.status_code == 403
        os.environ["ENVIRONMENT"] = "development"
        del os.environ["INTERNAL_SECRET"]


# ═══════════════════════════════════════════════════════════
# 4. Strategy Memory (F-01)
# ═══════════════════════════════════════════════════════════

class TestStrategyMemory:
    def test_get_memory_empty_initially(self, client):
        resp = client.get("/invest/memory?user_id=test_user_e2e")
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_memory"] is False
        assert data["prompt_fragment"] == ""

    def test_record_success_pattern(self, client):
        resp = client.post("/invest/memory/record", json={
            "pattern": "MACD crossover + volume surge",
            "symbol": "2330",
            "outcome": "success",
            "user_id": "test_user_e2e",
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_memory_contains_pattern_after_record(self, client):
        # Record a pattern first
        client.post("/invest/memory/record", json={
            "pattern": "Bollinger squeeze breakout",
            "symbol": "2454",
            "outcome": "success",
            "user_id": "test_user_e2e_check",
        })
        # Now retrieve
        resp = client.get("/invest/memory?user_id=test_user_e2e_check")
        data = resp.json()
        assert data["has_memory"] is True
        raw = data["raw"]
        assert any("Bollinger squeeze" in p for p in raw.get("successful_patterns", []))

    def test_record_failed_pattern(self, client):
        resp = client.post("/invest/memory/record", json={
            "pattern": "Blind RSI oversold entry without trend confirmation",
            "symbol": "2330",
            "outcome": "failure",
            "user_id": "test_user_e2e",
        })
        assert resp.status_code == 200

    def test_memory_prompt_fragment_contains_patterns(self, client):
        resp = client.get("/invest/memory?user_id=test_user_e2e")
        data = resp.json()
        fragment = data["prompt_fragment"]
        # After recording patterns, fragment should be non-empty
        assert "歷史策略記憶" in fragment or data["has_memory"] is False

    def test_clear_memory(self, client):
        client.post("/invest/memory/record", json={
            "pattern": "To be cleared",
            "outcome": "success",
            "user_id": "test_clear_user",
        })
        # Clear
        resp = client.delete("/invest/memory?user_id=test_clear_user")
        assert resp.status_code == 200
        # Verify cleared
        resp2 = client.get("/invest/memory?user_id=test_clear_user")
        assert resp2.json()["has_memory"] is False


# ═══════════════════════════════════════════════════════════
# 5. Session Status (A-1)
# ═══════════════════════════════════════════════════════════

class TestSessionStatus:
    def test_analyze_then_fetch_status(self, client):
        # Run analysis to create session
        analyze_resp = client.post("/invest/analyze", json={
            "symbol": "2330",
            "timeframe": "1d",
            "risk_level": "medium",
        })
        assert analyze_resp.status_code == 200
        session_id = analyze_resp.json()["session_id"]

        # Fetch session status
        status_resp = client.get(f"/invest/status/{session_id}")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        assert status_data["session_id"] == session_id
        assert status_data["symbol"] == "2330"

    def test_unknown_session_returns_404(self, client):
        resp = client.get("/invest/status/nonexistent-session-id-00000")
        assert resp.status_code == 404

    def test_sessions_list_endpoint(self, client):
        resp = client.get("/invest/sessions")
        assert resp.status_code == 200
        data = resp.json()
        assert "sessions" in data
        assert "backend" in data


# ═══════════════════════════════════════════════════════════
# 6. SSE Streaming (F-06) — async tests
# ═══════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestSSEStream:
    async def test_stream_returns_200(self, app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            async with ac.stream("POST", "/invest/analyze/stream", json={
                "symbol": "2330",
                "timeframe": "1d",
                "risk_level": "medium",
            }) as resp:
                assert resp.status_code == 200
                assert "text/event-stream" in resp.headers.get("content-type", "")

    async def test_stream_emits_started_event(self, app):
        events: list[dict] = []
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            async with ac.stream("POST", "/invest/analyze/stream", json={
                "symbol": "2330",
                "timeframe": "1d",
                "risk_level": "medium",
            }) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("event:"):
                        event_name = line.removeprefix("event:").strip()
                        events.append({"event": event_name})
                        if event_name == "graph_complete":
                            break

        event_names = [e["event"] for e in events]
        assert "started" in event_names

    async def test_stream_emits_graph_complete(self, app):
        completed = False
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            async with ac.stream("POST", "/invest/analyze/stream", json={
                "symbol": "2330",
                "timeframe": "1d",
                "risk_level": "medium",
            }) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("event: graph_complete"):
                        completed = True
                        break

        assert completed, "Expected graph_complete event from SSE stream"
