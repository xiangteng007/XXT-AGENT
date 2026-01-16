"""
Cloud SQL (PostgreSQL) client for candle storage.
"""
from __future__ import annotations
import psycopg


DDL = """
CREATE TABLE IF NOT EXISTS candles_1m (
  symbol TEXT NOT NULL,
  minute_ts_ms BIGINT NOT NULL,
  open DOUBLE PRECISION NOT NULL,
  high DOUBLE PRECISION NOT NULL,
  low DOUBLE PRECISION NOT NULL,
  close DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(symbol, minute_ts_ms)
);

CREATE INDEX IF NOT EXISTS idx_candles_1m_symbol_time 
ON candles_1m(symbol, minute_ts_ms DESC);
"""


class CandleSQL:
    """PostgreSQL client for storing finalized candles."""
    
    def __init__(self, host: str, db: str, user: str, password: str):
        self.conninfo = f"host={host} dbname={db} user={user} password={password} sslmode=disable"

    def ensure_schema(self) -> None:
        """Create table if not exists."""
        with psycopg.connect(self.conninfo) as conn:
            with conn.cursor() as cur:
                cur.execute(DDL)
            conn.commit()

    def upsert_candle(
        self,
        symbol: str,
        minute_ts_ms: int,
        o: float,
        h: float,
        l: float,
        c: float,
        v: float,
        finalized_at_iso: str,
    ) -> None:
        """Insert or update a finalized candle."""
        sql = """
        INSERT INTO candles_1m(symbol, minute_ts_ms, open, high, low, close, volume, finalized_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT(symbol, minute_ts_ms)
        DO UPDATE SET 
            open=EXCLUDED.open, 
            high=EXCLUDED.high, 
            low=EXCLUDED.low,
            close=EXCLUDED.close, 
            volume=EXCLUDED.volume, 
            finalized_at=EXCLUDED.finalized_at;
        """
        with psycopg.connect(self.conninfo) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (symbol, minute_ts_ms, o, h, l, c, v, finalized_at_iso))
            conn.commit()
