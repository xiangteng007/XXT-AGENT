"""
Symbol extraction utilities for news → symbol mapping.
"""
from __future__ import annotations
import re

# Regex for ticker symbols (1-5 uppercase letters)
TICKER_RE = re.compile(r"\b[A-Z]{1,5}\b")


def extract_symbols_from_related(related: str) -> list[str]:
    """
    Extract symbols from Finnhub 'related' field.
    Format: comma-separated tickers.
    """
    if not related:
        return []
    parts = [p.strip().upper() for p in related.split(",") if p.strip()]
    return [p for p in parts if 1 <= len(p) <= 5]


def extract_symbols_from_text(text: str) -> list[str]:
    """
    Extract potential ticker symbols from headline text.
    Uses regex to find uppercase letter sequences.
    """
    if not text:
        return []
    # Deduplicate while preserving order
    return list(dict.fromkeys(TICKER_RE.findall(text.upper())))
