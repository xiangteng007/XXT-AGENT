"""
Simulation Engine — Virtual Portfolio & Paper Trading

Provides a complete virtual trading environment:
- Virtual account with cash and positions
- Order execution with simulated fills
- Position tracking with P&L calculation
- Redis persistence for state durability
- Transaction cost modeling (commission + slippage)

Usage:
    engine = SimulationEngine(redis_url="redis://localhost:6379")
    await engine.initialize()
    result = await engine.execute_order("BUY", "2330.TW", 100, 580.0)
    portfolio = await engine.get_portfolio()
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any

logger = logging.getLogger("investment-brain.simulation")

# ── Configuration ──────────────────────────────────────────────

DEFAULT_INITIAL_CASH = 1_000_000.0  # NT$1M virtual capital
COMMISSION_RATE = 0.001425          # 台股手續費 0.1425%
TAX_RATE = 0.003                    # 證交稅 0.3% (賣出)
SLIPPAGE_BPS = 5                    # 5 basis points slippage


# ── Data Models ────────────────────────────────────────────────


@dataclass
class Position:
    """Open position in the virtual portfolio."""
    symbol: str
    shares: float
    avg_cost: float
    current_price: float = 0.0
    opened_at: str = ""
    last_updated: str = ""

    @property
    def market_value(self) -> float:
        return self.shares * self.current_price

    @property
    def unrealized_pnl(self) -> float:
        return (self.current_price - self.avg_cost) * self.shares

    @property
    def unrealized_pnl_pct(self) -> float:
        if self.avg_cost <= 0:
            return 0.0
        return ((self.current_price / self.avg_cost) - 1) * 100

    def to_dict(self) -> dict:
        return {
            **asdict(self),
            "market_value": round(self.market_value, 2),
            "unrealized_pnl": round(self.unrealized_pnl, 2),
            "unrealized_pnl_pct": round(self.unrealized_pnl_pct, 2),
        }


@dataclass
class TradeRecord:
    """Completed trade record."""
    trade_id: str
    symbol: str
    action: str  # BUY / SELL
    shares: float
    price: float
    commission: float
    tax: float
    slippage: float
    net_amount: float
    pnl: float = 0.0
    pnl_pct: float = 0.0
    executed_at: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class PortfolioSnapshot:
    """Full portfolio state at a point in time."""
    total_value: float
    cash: float
    positions: list[dict]
    daily_pnl: float = 0.0
    daily_pnl_pct: float = 0.0
    max_drawdown: float = 0.0
    sharpe_ratio: float | None = None
    win_rate: float | None = None
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    timestamp: str = ""


# ── Simulation Engine ──────────────────────────────────────────


class SimulationEngine:
    """
    Virtual portfolio and paper trading engine.

    State is persisted to Redis for durability across restarts.
    Falls back to in-memory if Redis is unavailable.
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        initial_cash: float = DEFAULT_INITIAL_CASH,
        user_id: str = "default",
    ):
        self._redis_url = redis_url
        self._initial_cash = initial_cash
        self._user_id = user_id
        self._redis = None

        # In-memory state
        self._cash = initial_cash
        self._positions: dict[str, Position] = {}
        self._trades: list[TradeRecord] = []
        self._equity_curve: list[float] = [initial_cash]
        self._peak_equity = initial_cash
        self._initialized = False

    # ── Redis persistence ──────────────────────────────────

    async def _get_redis(self):
        if self._redis is not None:
            return self._redis
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                self._redis_url, decode_responses=True, socket_timeout=2.0
            )
            await self._redis.ping()
            return self._redis
        except Exception as e:
            logger.warning(f"[SimEngine] Redis unavailable: {e}, using in-memory")
            self._redis = None
            return None

    async def _save_state(self) -> None:
        redis = await self._get_redis()
        if not redis:
            return
        key = f"sim:portfolio:{self._user_id}"
        state = {
            "cash": self._cash,
            "positions": {s: asdict(p) for s, p in self._positions.items()},
            "trades": [asdict(t) for t in self._trades[-200:]],
            "equity_curve": self._equity_curve[-500:],
            "peak_equity": self._peak_equity,
            "updated_at": datetime.utcnow().isoformat(),
        }
        try:
            await redis.set(key, json.dumps(state), ex=86400 * 30)  # 30 days
        except Exception as e:
            logger.warning(f"[SimEngine] Failed to save state: {e}")

    async def _load_state(self) -> bool:
        redis = await self._get_redis()
        if not redis:
            return False
        key = f"sim:portfolio:{self._user_id}"
        try:
            raw = await redis.get(key)
            if not raw:
                return False
            state = json.loads(raw)
            self._cash = state.get("cash", self._initial_cash)
            for sym, pos_data in state.get("positions", {}).items():
                self._positions[sym] = Position(**pos_data)
            self._trades = [TradeRecord(**t) for t in state.get("trades", [])]
            self._equity_curve = state.get("equity_curve", [self._initial_cash])
            self._peak_equity = state.get("peak_equity", self._initial_cash)
            logger.info(f"[SimEngine] Restored state: cash={self._cash:.0f}, positions={len(self._positions)}")
            return True
        except Exception as e:
            logger.warning(f"[SimEngine] Failed to load state: {e}")
            return False

    async def initialize(self) -> None:
        """Initialize engine — load state from Redis if available."""
        if self._initialized:
            return
        loaded = await self._load_state()
        if not loaded:
            logger.info(f"[SimEngine] Fresh start: cash={self._initial_cash:.0f}")
        self._initialized = True

    # ── Order Execution ────────────────────────────────────

    async def execute_order(
        self,
        action: str,
        symbol: str,
        shares: float,
        price: float,
    ) -> TradeRecord:
        """
        Execute a virtual trade order.

        Args:
            action: "BUY" or "SELL"
            symbol: Stock symbol
            shares: Number of shares
            price: Target price

        Returns:
            TradeRecord with execution details
        """
        await self.initialize()
        now = datetime.utcnow().isoformat()

        # Apply slippage
        slippage_pct = SLIPPAGE_BPS / 10000
        if action.upper() == "BUY":
            fill_price = price * (1 + slippage_pct)  # Buy higher
        else:
            fill_price = price * (1 - slippage_pct)  # Sell lower

        gross_amount = shares * fill_price
        commission = gross_amount * COMMISSION_RATE
        tax = gross_amount * TAX_RATE if action.upper() == "SELL" else 0.0
        slippage_cost = abs(fill_price - price) * shares

        trade = TradeRecord(
            trade_id=str(uuid.uuid4())[:8],
            symbol=symbol,
            action=action.upper(),
            shares=shares,
            price=round(fill_price, 4),
            commission=round(commission, 2),
            tax=round(tax, 2),
            slippage=round(slippage_cost, 2),
            net_amount=0.0,
            executed_at=now,
        )

        if action.upper() == "BUY":
            net_cost = gross_amount + commission
            if net_cost > self._cash:
                # Partial fill based on available cash
                affordable_shares = int((self._cash - commission) / fill_price)
                if affordable_shares <= 0:
                    trade.net_amount = 0.0
                    trade.pnl = 0.0
                    logger.warning(f"[SimEngine] Insufficient cash for {symbol} BUY")
                    return trade
                shares = affordable_shares
                gross_amount = shares * fill_price
                commission = gross_amount * COMMISSION_RATE
                net_cost = gross_amount + commission
                trade.shares = shares
                trade.commission = round(commission, 2)

            self._cash -= net_cost
            trade.net_amount = round(-net_cost, 2)

            # Update or create position
            if symbol in self._positions:
                pos = self._positions[symbol]
                total_cost = pos.avg_cost * pos.shares + fill_price * shares
                total_shares = pos.shares + shares
                pos.avg_cost = total_cost / total_shares
                pos.shares = total_shares
                pos.last_updated = now
            else:
                self._positions[symbol] = Position(
                    symbol=symbol,
                    shares=shares,
                    avg_cost=fill_price,
                    current_price=fill_price,
                    opened_at=now,
                    last_updated=now,
                )

        elif action.upper() == "SELL":
            pos = self._positions.get(symbol)
            if not pos or pos.shares <= 0:
                logger.warning(f"[SimEngine] No position to sell: {symbol}")
                return trade

            sell_shares = min(shares, pos.shares)
            net_proceeds = sell_shares * fill_price - commission - tax
            trade.shares = sell_shares
            trade.net_amount = round(net_proceeds, 2)
            trade.pnl = round((fill_price - pos.avg_cost) * sell_shares - commission - tax, 2)
            trade.pnl_pct = round(((fill_price / pos.avg_cost) - 1) * 100, 2) if pos.avg_cost > 0 else 0.0

            self._cash += net_proceeds
            pos.shares -= sell_shares
            if pos.shares <= 0:
                del self._positions[symbol]
            else:
                pos.last_updated = now

        self._trades.append(trade)
        self._update_equity()
        await self._save_state()

        logger.info(
            f"[SimEngine] {trade.action} {trade.shares} {trade.symbol} "
            f"@ {trade.price} | PnL: {trade.pnl} | Cash: {self._cash:.0f}"
        )
        return trade

    # ── Portfolio ───────────────────────────────────────────

    def _update_equity(self) -> None:
        """Update equity curve and peak tracking."""
        equity = self._cash + sum(p.market_value for p in self._positions.values())
        self._equity_curve.append(equity)
        if equity > self._peak_equity:
            self._peak_equity = equity

    async def update_prices(self, prices: dict[str, float]) -> None:
        """Update current prices for all positions."""
        for sym, price in prices.items():
            if sym in self._positions:
                self._positions[sym].current_price = price
                self._positions[sym].last_updated = datetime.utcnow().isoformat()
        self._update_equity()

    async def get_portfolio(self) -> PortfolioSnapshot:
        """Get current portfolio state."""
        await self.initialize()

        total_value = self._cash + sum(p.market_value for p in self._positions.values())
        daily_pnl = total_value - (self._equity_curve[-2] if len(self._equity_curve) >= 2 else self._initial_cash)
        daily_pnl_pct = (daily_pnl / self._equity_curve[-2] * 100) if len(self._equity_curve) >= 2 and self._equity_curve[-2] > 0 else 0.0

        # Max drawdown
        max_dd = 0.0
        if self._peak_equity > 0:
            max_dd = min(0.0, (total_value / self._peak_equity) - 1)

        # Win rate
        completed = [t for t in self._trades if t.action == "SELL"]
        winning = [t for t in completed if t.pnl > 0]
        win_rate = (len(winning) / len(completed) * 100) if completed else None

        # Sharpe ratio from equity curve
        sharpe = None
        if len(self._equity_curve) >= 10:
            import numpy as np
            returns = np.diff(self._equity_curve) / self._equity_curve[:-1]
            if len(returns) > 1 and np.std(returns) > 0:
                sharpe = round(float(np.mean(returns) / np.std(returns) * np.sqrt(252)), 4)

        return PortfolioSnapshot(
            total_value=round(total_value, 2),
            cash=round(self._cash, 2),
            positions=[p.to_dict() for p in self._positions.values()],
            daily_pnl=round(daily_pnl, 2),
            daily_pnl_pct=round(daily_pnl_pct, 2),
            max_drawdown=round(max_dd * 100, 2),
            sharpe_ratio=sharpe,
            win_rate=round(win_rate, 1) if win_rate is not None else None,
            total_trades=len(self._trades),
            winning_trades=len(winning),
            losing_trades=len(completed) - len(winning),
            timestamp=datetime.utcnow().isoformat(),
        )

    async def get_trade_history(self, limit: int = 50) -> list[dict]:
        """Get recent trade history."""
        return [t.to_dict() for t in self._trades[-limit:]]

    async def reset(self) -> None:
        """Reset portfolio to initial state."""
        self._cash = self._initial_cash
        self._positions.clear()
        self._trades.clear()
        self._equity_curve = [self._initial_cash]
        self._peak_equity = self._initial_cash
        await self._save_state()
        logger.info("[SimEngine] Portfolio reset")

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()
