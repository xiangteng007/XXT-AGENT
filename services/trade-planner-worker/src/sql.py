"""
Cloud SQL (PostgreSQL) client for reading candle data.
"""
from __future__ import annotations
import psycopg


class CandleSQL:
    """PostgreSQL client for reading candle data."""
    
    def __init__(self, host: str, db: str, user: str, password: str):
        self.conninfo = f"host={host} dbname={db} user={user} password={password} sslmode=disable"

    def fetch_recent_1m(self, symbol: str, limit: int = 120) -> list[dict]:
        """Fetch recent 1-minute candles for a symbol."""
        sql = """
        SELECT symbol, minute_ts_ms, open, high, low, close, volume, finalized_at
        FROM candles_1m
        WHERE symbol = %s
        ORDER BY minute_ts_ms DESC
        LIMIT %s
        """
        out: list[dict] = []
        
        try:
            with psycopg.connect(self.conninfo) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (symbol, limit))
                    rows = cur.fetchall()
            
            for r in rows:
                out.append({
                    "symbol": r[0],
                    "minute_ts_ms": int(r[1]),
                    "open": float(r[2]),
                    "high": float(r[3]),
                    "low": float(r[4]),
                    "close": float(r[5]),
                    "volume": float(r[6]),
                    "finalized_at": str(r[7]),
                })
        except Exception:
            pass
        
        return out
