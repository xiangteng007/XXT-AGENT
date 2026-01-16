"""
Redis state management for alert cooldowns.
"""
from __future__ import annotations
import redis


class AlertState:
    """Manages alert cooldowns in Redis with type-aware keys."""
    
    def __init__(self, host: str, port: int):
        self.r = redis.Redis(host=host, port=port, decode_responses=True)

    def cooldown_key(self, kind: str, symbol: str) -> str:
        """
        Generate Redis key for cooldown.
        
        Args:
            kind: Event type (e.g., "candle_1m", "fused_event")
            symbol: Ticker symbol (e.g., "AAPL")
        """
        return f"alert:cooldown:{kind}:{symbol}"

    def can_alert(self, kind: str, symbol: str) -> bool:
        """Check if an alert can be sent for this event type and symbol."""
        return self.r.get(self.cooldown_key(kind, symbol)) is None

    def set_cooldown(self, kind: str, symbol: str, ttl_sec: int) -> None:
        """Set cooldown for an event type and symbol after alerting."""
        self.r.set(self.cooldown_key(kind, symbol), "1", ex=ttl_sec)
    
    def clear_cooldown(self, kind: str, symbol: str) -> None:
        """Clear cooldown for testing."""
        self.r.delete(self.cooldown_key(kind, symbol))
