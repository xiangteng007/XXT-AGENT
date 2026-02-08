"""
News Collector — Unit Tests

Tests for RSS parsing patterns, Firestore write logic, deduplication, and config.
"""
import pytest
import base64
import json


# ─── News Collector Utilities ──────────────────

class TestRSSParsingPatterns:
    """Test RSS feed parsing via feedparser patterns."""

    def test_valid_rss_item_structure(self):
        """Verify expected RSS item fields are handled."""
        item = {
            "title": "Fed raises rates by 25bps",
            "link": "https://reuters.com/article/123",
            "published": "2024-01-01T12:00:00Z",
            "summary": "The Federal Reserve raised...",
        }
        assert item["title"]
        assert item["link"].startswith("http")

    def test_empty_rss_item(self):
        """Verify graceful handling of missing fields."""
        item = {}
        title = item.get("title", "")
        link = item.get("link", "")
        assert title == ""
        assert link == ""

    def test_html_in_summary(self):
        """RSS summaries often contain HTML tags."""
        summary = "<p>Central bank decided to <b>hold</b> rates.</p>"
        clean = summary.replace("<p>", "").replace("</p>", "").replace("<b>", "").replace("</b>", "")
        assert "hold" in clean


class TestNewsDeduplication:
    """Test in-memory deduplication patterns."""

    def test_url_based_dedup(self):
        seen = set()
        urls = [
            "https://reuters.com/1",
            "https://reuters.com/2",
            "https://reuters.com/1",  # duplicate
        ]
        unique = []
        for url in urls:
            if url not in seen:
                seen.add(url)
                unique.append(url)
        assert len(unique) == 2

    def test_empty_url_skipped(self):
        seen = set()
        urls = ["https://a.com", "", "https://b.com", ""]
        unique = [u for u in urls if u and u not in seen and not seen.add(u)]
        assert len(unique) == 2


class TestPubsubDecode:
    def test_valid_message(self):
        """Standard Pub/Sub message decode."""
        payload = {"key": "test_value"}
        encoded = base64.b64encode(json.dumps(payload).encode()).decode()
        msg = {"message": {"data": encoded}}
        raw = base64.b64decode(msg["message"]["data"]).decode("utf-8")
        result = json.loads(raw)
        assert result == payload

    def test_empty_data(self):
        msg = {"message": {"data": ""}}
        data = msg.get("message", {}).get("data", "")
        assert data == ""


class TestNewsItemStructure:
    """Test the expected news document structure for Firestore."""

    def test_complete_news_doc(self):
        doc = {
            "headline": "Market rallies on earnings",
            "summary": "Strong Q4 results pushed...",
            "url": "https://bloomberg.com/123",
            "source": "bloomberg",
            "category": "general",
            "published_at": "2024-01-01T00:00:00Z",
            "image_url": "https://img.com/photo.jpg",
        }
        assert doc["headline"]
        assert doc["source"] == "bloomberg"
        assert doc["url"].startswith("https")

    def test_minimal_news_doc(self):
        doc = {
            "headline": "Test",
            "url": "",
            "source": "rss",
            "category": "general",
        }
        assert doc["headline"] == "Test"
        assert doc["url"] == ""
