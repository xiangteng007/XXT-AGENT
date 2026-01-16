"""
Redis candle store with atomic Lua script updates.
"""
from __future__ import annotations
import redis
from typing import Optional

# Lua script for atomic candle upsert
LUA_UPSERT_CANDLE = r"""
-- KEYS[1] = candle key
-- ARGV: price, volume, ts_ms, ttl_sec
local key = KEYS[1]
local price = tonumber(ARGV[1])
local vol = tonumber(ARGV[2])
local ts_ms = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local exists = redis.call("EXISTS", key)
if exists == 0 then
  -- open/high/low/close initialized to price
  redis.call("HSET", key,
    "open", price,
    "high", price,
    "low", price,
    "close", price,
    "volume", vol,
    "last_update_ms", ts_ms
  )
  redis.call("EXPIRE", key, ttl)
else
  local high = tonumber(redis.call("HGET", key, "high"))
  local low  = tonumber(redis.call("HGET", key, "low"))
  if price > high then
    redis.call("HSET", key, "high", price)
  end
  if price < low then
    redis.call("HSET", key, "low", price)
  end
  redis.call("HSET", key, "close", price)
  redis.call("HINCRBYFLOAT", key, "volume", vol)
  redis.call("HSET", key, "last_update_ms", ts_ms)
end

return 1
"""


class CandleRedisStore:
    """Redis store for aggregating 1m OHLCV candles."""
    
    def __init__(self, host: str, port: int):
        self.r = redis.Redis(host=host, port=port, decode_responses=True)
        self._upsert = self.r.register_script(LUA_UPSERT_CANDLE)

    @staticmethod
    def candle_key(symbol: str, minute_ts_ms: int) -> str:
        """Generate Redis key for a candle."""
        return f"candle:1m:{symbol}:{minute_ts_ms}"

    def upsert_trade(
        self, 
        symbol: str, 
        minute_ts_ms: int, 
        price: float, 
        volume: float, 
        ts_ms: int, 
        ttl_sec: int
    ) -> None:
        """Atomically update or create a candle with trade data."""
        key = self.candle_key(symbol, minute_ts_ms)
        self._upsert(keys=[key], args=[price, volume, ts_ms, ttl_sec])

    def scan_candle_keys(self, count: int = 2000):
        """Scan all candle keys in Redis."""
        cursor = 0
        while True:
            cursor, keys = self.r.scan(cursor=cursor, match="candle:1m:*", count=count)
            for k in keys:
                yield k
            if cursor == 0:
                break

    def get_candle_hash(self, key: str) -> Optional[dict]:
        """Get all fields of a candle hash."""
        data = self.r.hgetall(key)
        return data if data else None

    def delete_key(self, key: str) -> None:
        """Delete a candle key after finalization."""
        self.r.delete(key)
