"""
Backtest Engine — Multi-Strategy Historical Performance Analysis

Strategies:
- buy_and_hold: Baseline buy-and-hold
- sma_crossover: SMA 20/50 golden/death cross
- rsi_reversal: RSI oversold buy / overbought sell
- breakout_volume: Volume breakout entry

All strategies include transaction cost modeling (commission + tax + slippage).
"""
from __future__ import annotations

from typing import Any
import pandas as pd
import numpy as np
import logging

logger = logging.getLogger("investment-brain.backtest")

# Taiwan stock transaction costs
COMMISSION_RATE = 0.001425    # 0.1425%
TAX_RATE = 0.003              # 0.3% (sell only)
SLIPPAGE_BPS = 5              # 5 basis points


class BacktestEngine:
    """Multi-strategy backtesting engine with transaction cost modeling."""

    def __init__(self, risk_free_rate: float = 0.02):
        self.risk_free_rate = risk_free_rate
        self._strategies = {
            "buy_and_hold": self._strategy_buy_and_hold,
            "sma_crossover": self._strategy_sma_crossover,
            "rsi_reversal": self._strategy_rsi_reversal,
            "breakout_volume": self._strategy_breakout_volume,
        }

    # ── Public API ─────────────────────────────────────────

    def calculate_metrics(self, data: list[dict[str, Any]], strategy: str = "buy_and_hold") -> dict:
        """
        Run backtest with specified strategy and return performance metrics.

        Args:
            data: List of OHLCV candles [{date, open, high, low, close, volume}, ...]
            strategy: Strategy name (buy_and_hold, sma_crossover, rsi_reversal, breakout_volume)
        """
        if not data:
            return {"error": "No data provided for backtesting."}

        df = pd.DataFrame(data)
        if df.empty or "close" not in df.columns:
            return {"error": "Invalid data format or empty sequence."}

        # Normalize columns
        df["date"] = pd.to_datetime(df.get("date", df.get("datetime", "")))
        df = df.sort_values("date").reset_index(drop=True)
        for col in ["open", "high", "low", "close", "volume"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        df["daily_return"] = df["close"].pct_change()

        # Run strategy
        strategy_fn = self._strategies.get(strategy, self._strategy_buy_and_hold)
        signals = strategy_fn(df)

        # Compute strategy returns with costs
        result = self._compute_performance(df, signals, strategy)
        return result

    def run_all_strategies(self, data: list[dict[str, Any]]) -> dict:
        """Run all strategies and return comparative results."""
        results = {}
        for name in self._strategies:
            results[name] = self.calculate_metrics(data, strategy=name)
        return {
            "strategies": results,
            "best_strategy": max(
                results,
                key=lambda k: results[k].get("sharpe_ratio", -999)
                if "error" not in results[k] else -999,
            ),
        }

    # ── Strategies ─────────────────────────────────────────

    @staticmethod
    def _strategy_buy_and_hold(df: pd.DataFrame) -> pd.Series:
        """Buy on day 1, hold until end."""
        signals = pd.Series(0, index=df.index)
        signals.iloc[0] = 1  # Buy
        return signals

    @staticmethod
    def _strategy_sma_crossover(df: pd.DataFrame) -> pd.Series:
        """
        SMA 20/50 Crossover Strategy.
        Buy when SMA20 crosses above SMA50, sell when crosses below.
        """
        df = df.copy()
        df["sma20"] = df["close"].rolling(20).mean()
        df["sma50"] = df["close"].rolling(50).mean()

        signals = pd.Series(0, index=df.index)
        for i in range(51, len(df)):
            if df["sma20"].iloc[i] > df["sma50"].iloc[i] and df["sma20"].iloc[i - 1] <= df["sma50"].iloc[i - 1]:
                signals.iloc[i] = 1   # Golden cross → Buy
            elif df["sma20"].iloc[i] < df["sma50"].iloc[i] and df["sma20"].iloc[i - 1] >= df["sma50"].iloc[i - 1]:
                signals.iloc[i] = -1  # Death cross → Sell

        return signals

    @staticmethod
    def _strategy_rsi_reversal(df: pd.DataFrame, period: int = 14, oversold: int = 30, overbought: int = 70) -> pd.Series:
        """
        RSI Mean-Reversion Strategy.
        Buy when RSI drops below 30, sell when RSI rises above 70.
        """
        df = df.copy()
        delta = df["close"].diff()
        gain = delta.clip(lower=0).rolling(period).mean()
        loss = (-delta.clip(upper=0)).rolling(period).mean()
        rs = gain / loss.replace(0, np.nan)
        df["rsi"] = 100 - (100 / (1 + rs))

        signals = pd.Series(0, index=df.index)
        for i in range(period + 1, len(df)):
            if df["rsi"].iloc[i] < oversold and df["rsi"].iloc[i - 1] >= oversold:
                signals.iloc[i] = 1   # Oversold → Buy
            elif df["rsi"].iloc[i] > overbought and df["rsi"].iloc[i - 1] <= overbought:
                signals.iloc[i] = -1  # Overbought → Sell

        return signals

    @staticmethod
    def _strategy_breakout_volume(df: pd.DataFrame, volume_mult: float = 1.5, lookback: int = 20) -> pd.Series:
        """
        Volume Breakout Strategy.
        Buy when price breaks above lookback high on volume > 1.5x average.
        Sell when price drops below lookback low.
        """
        if "volume" not in df.columns or df["volume"].isna().all():
            # No volume data — fallback to buy and hold
            return BacktestEngine._strategy_buy_and_hold(df)

        df = df.copy()
        df["vol_avg"] = df["volume"].rolling(lookback).mean()
        df["high_lookback"] = df["high"].rolling(lookback).max().shift(1)
        df["low_lookback"] = df["low"].rolling(lookback).min().shift(1)

        signals = pd.Series(0, index=df.index)
        for i in range(lookback + 1, len(df)):
            if (df["close"].iloc[i] > df["high_lookback"].iloc[i]
                    and df["volume"].iloc[i] > df["vol_avg"].iloc[i] * volume_mult):
                signals.iloc[i] = 1   # Breakout buy
            elif df["close"].iloc[i] < df["low_lookback"].iloc[i]:
                signals.iloc[i] = -1  # Breakdown sell

        return signals

    # ── Performance Calculation ────────────────────────────

    def _compute_performance(self, df: pd.DataFrame, signals: pd.Series, strategy_name: str) -> dict:
        """Compute strategy performance with transaction costs."""
        in_position = False
        entry_price = 0.0
        cash = 1_000_000.0
        shares = 0.0
        initial_cash = cash
        trades: list[dict] = []
        equity_curve: list[float] = []

        for i in range(len(df)):
            price = df["close"].iloc[i]
            signal = signals.iloc[i]

            if signal == 1 and not in_position:
                # BUY
                slippage = price * (SLIPPAGE_BPS / 10000)
                fill_price = price + slippage
                affordable = int(cash / (fill_price * (1 + COMMISSION_RATE)))
                if affordable > 0:
                    commission = affordable * fill_price * COMMISSION_RATE
                    cash -= affordable * fill_price + commission
                    shares = affordable
                    entry_price = fill_price
                    in_position = True
                    trades.append({
                        "action": "BUY",
                        "date": str(df["date"].iloc[i].date()),
                        "price": round(fill_price, 2),
                        "shares": shares,
                        "commission": round(commission, 2),
                    })

            elif signal == -1 and in_position:
                # SELL
                slippage = price * (SLIPPAGE_BPS / 10000)
                fill_price = price - slippage
                gross = shares * fill_price
                commission = gross * COMMISSION_RATE
                tax = gross * TAX_RATE
                cash += gross - commission - tax
                pnl = (fill_price - entry_price) * shares - commission - tax
                trades.append({
                    "action": "SELL",
                    "date": str(df["date"].iloc[i].date()),
                    "price": round(fill_price, 2),
                    "shares": shares,
                    "commission": round(commission, 2),
                    "tax": round(tax, 2),
                    "pnl": round(pnl, 2),
                })
                shares = 0
                in_position = False

            # Track equity
            equity = cash + (shares * price if in_position else 0)
            equity_curve.append(equity)

        # Final close if still in position
        if in_position:
            final_price = df["close"].iloc[-1]
            gross = shares * final_price
            commission = gross * COMMISSION_RATE
            tax = gross * TAX_RATE
            cash += gross - commission - tax
            pnl = (final_price - entry_price) * shares - commission - tax
            trades.append({
                "action": "SELL (close)",
                "date": str(df["date"].iloc[-1].date()),
                "price": round(final_price, 2),
                "shares": shares,
                "pnl": round(pnl, 2),
            })
            equity_curve[-1] = cash

        # Metrics
        final_equity = equity_curve[-1] if equity_curve else initial_cash
        total_return = (final_equity / initial_cash) - 1
        trading_days = len(df)
        annualized_return = (1 + total_return) ** (252 / max(trading_days, 1)) - 1

        # Equity-based volatility and Sharpe
        eq_series = pd.Series(equity_curve)
        eq_returns = eq_series.pct_change().dropna()
        ann_vol = float(eq_returns.std() * np.sqrt(252)) if len(eq_returns) > 1 else 0
        sharpe = (annualized_return - self.risk_free_rate) / ann_vol if ann_vol > 0 else 0

        # Max drawdown
        eq_peak = eq_series.cummax()
        drawdown = (eq_series / eq_peak) - 1
        max_dd = float(drawdown.min()) if len(drawdown) > 0 else 0

        # Win rate
        sell_trades = [t for t in trades if "pnl" in t]
        wins = sum(1 for t in sell_trades if t["pnl"] > 0)
        win_rate = (wins / len(sell_trades) * 100) if sell_trades else None

        # Total costs
        total_commission = sum(t.get("commission", 0) for t in trades)
        total_tax = sum(t.get("tax", 0) for t in trades)

        return {
            "strategy": strategy_name,
            "total_return": round(total_return, 4),
            "annualized_return": round(annualized_return, 4),
            "annualized_volatility": round(ann_vol, 4),
            "sharpe_ratio": round(sharpe, 4),
            "max_drawdown": round(max_dd, 4),
            "trading_days_analyzed": trading_days,
            "total_trades": len(trades),
            "win_rate": round(win_rate, 1) if win_rate is not None else None,
            "transaction_costs": {
                "total_commission": round(total_commission, 2),
                "total_tax": round(total_tax, 2),
                "total": round(total_commission + total_tax, 2),
            },
            "trades": trades[-20:],  # Last 20 trades for UI
            "period": {
                "start": df["date"].iloc[0].strftime("%Y-%m-%d"),
                "end": df["date"].iloc[-1].strftime("%Y-%m-%d"),
                "start_price": float(df["close"].iloc[0]),
                "end_price": float(df["close"].iloc[-1]),
            },
        }
