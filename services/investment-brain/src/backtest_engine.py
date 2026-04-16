from typing import List, Dict, Any, Tuple
import pandas as pd
import numpy as np

class BacktestEngine:
    def __init__(self, risk_free_rate: float = 0.02):
        self.risk_free_rate = risk_free_rate

    def calculate_metrics(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate quantitative trading metrics assuming a simple buy-and-hold strategy
        as a baseline, using Fugle historical candles format.
        """
        if not data:
            return {"error": "No data provided for backtesting."}

        # Fugle format typically: [{'date': '2023-01-01', 'close': 100.5, ...}, ...]
        df = pd.DataFrame(data)
        if df.empty or 'close' not in df.columns:
            return {"error": "Invalid data format or empty sequence."}

        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)
        # Assuming 'close' might be numeric or string, cast appropriately
        df['close'] = pd.to_numeric(df['close'], errors='coerce')
        
        # Calculate daily returns
        df['daily_return'] = df['close'].pct_change()
        
        # Calculate Annualized Return
        total_return = (df['close'].iloc[-1] / df['close'].iloc[0]) - 1
        trading_days = len(df)
        annualized_return = (1 + total_return) ** (252 / trading_days) - 1 if trading_days > 0 else 0

        # Calculate Annualized Volatility
        annualized_volatility = df['daily_return'].std() * np.sqrt(252)

        # Calculate Sharpe Ratio
        if annualized_volatility > 0:
            sharpe_ratio = (annualized_return - self.risk_free_rate) / annualized_volatility
        else:
            sharpe_ratio = 0.0
            
        # Calculate Max Drawdown
        df['cumulative_return'] = (1 + df['daily_return']).cumprod()
        df['cumulative_max'] = df['cumulative_return'].cummax()
        df['drawdown'] = df['cumulative_return'] / df['cumulative_max'] - 1
        max_drawdown = df['drawdown'].min()

        return {
            "total_return": round(total_return, 4),
            "annualized_return": round(annualized_return, 4),
            "annualized_volatility": round(annualized_volatility, 4),
            "sharpe_ratio": round(sharpe_ratio, 4),
            "max_drawdown": round(max_drawdown, 4),
            "trading_days_analyzed": trading_days,
            "period": {
                "start": df['date'].iloc[0].strftime("%Y-%m-%d"),
                "end": df['date'].iloc[-1].strftime("%Y-%m-%d"),
                "start_price": df['close'].iloc[0],
                "end_price": df['close'].iloc[-1],
            }
        }
