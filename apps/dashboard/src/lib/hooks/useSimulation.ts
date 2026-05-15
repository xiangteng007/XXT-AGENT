'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';

// ── Types ──────────────────────────────────────────────────

export interface Position {
    symbol: string;
    shares: number;
    avg_cost: number;
    current_price: number;
    market_value: number;
    unrealized_pnl: number;
    unrealized_pnl_pct: number;
    opened_at: string;
}

export interface PortfolioState {
    total_value: number;
    cash: number;
    positions: Position[];
    daily_pnl: number;
    daily_pnl_pct: number;
    max_drawdown: number;
    sharpe_ratio: number | null;
    win_rate: number | null;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    timestamp: string;
}

export interface TradeRecord {
    trade_id: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    shares: number;
    price: number;
    commission: number;
    tax: number;
    slippage: number;
    net_amount: number;
    pnl: number;
    pnl_pct: number;
    executed_at: string;
    status?: string;
}

const defaultPortfolio: PortfolioState = {
    total_value: 1_000_000,
    cash: 1_000_000,
    positions: [],
    daily_pnl: 0,
    daily_pnl_pct: 0,
    max_drawdown: 0,
    sharpe_ratio: null,
    win_rate: null,
    total_trades: 0,
    winning_trades: 0,
    losing_trades: 0,
    timestamp: '',
};

// ── Hook ───────────────────────────────────────────────────

/**
 * useSimulation — Virtual portfolio management hook.
 *
 * Provides reactive state for the simulation engine via
 * Investment Brain API endpoints.
 */
export function useSimulation() {
    const { getIdToken } = useAuth();
    const [portfolio, setPortfolio] = useState<PortfolioState>(defaultPortfolio);
    const [trades, setTrades] = useState<TradeRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const authHeaders = useCallback(async () => {
        const token = await getIdToken();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        };
    }, [getIdToken]);

    /** Fetch current portfolio state */
    const refreshPortfolio = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const headers = await authHeaders();
            const res = await fetch('/api/market/portfolio', { headers });
            if (res.ok) {
                const data = await res.json();
                setPortfolio(data);
            } else {
                setError('無法載入投資組合');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '連線失敗');
        }
        setIsLoading(false);
    }, [authHeaders]);

    /** Fetch trade history */
    const refreshTrades = useCallback(async (limit = 50) => {
        try {
            const headers = await authHeaders();
            const res = await fetch(`/api/market/portfolio/trades?limit=${limit}`, { headers });
            if (res.ok) {
                const data = await res.json();
                setTrades(data.trades || []);
            }
        } catch (err) {
            console.error('Failed to fetch trades:', err);
        }
    }, [authHeaders]);

    /** Execute a manual paper trade */
    const placeOrder = useCallback(async (
        action: 'BUY' | 'SELL',
        symbol: string,
        shares: number,
        price?: number,
    ) => {
        setIsLoading(true);
        setError(null);
        try {
            const headers = await authHeaders();
            const res = await fetch('/api/market/portfolio/order', {
                method: 'POST',
                headers,
                body: JSON.stringify({ action, symbol, shares, price }),
            });

            if (!res.ok) {
                const err = await res.json();
                setError(err.error || '下單失敗');
                setIsLoading(false);
                return null;
            }

            const result = await res.json();
            // Refresh portfolio state after trade
            await refreshPortfolio();
            await refreshTrades();
            setIsLoading(false);
            return result;
        } catch (err) {
            setError(err instanceof Error ? err.message : '下單失敗');
            setIsLoading(false);
            return null;
        }
    }, [authHeaders, refreshPortfolio, refreshTrades]);

    /** Reset portfolio to initial state */
    const resetPortfolio = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const headers = await authHeaders();
            const res = await fetch('/api/market/portfolio/reset', {
                method: 'POST',
                headers,
            });

            if (res.ok) {
                await refreshPortfolio();
                setTrades([]);
            } else {
                setError('重置失敗');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '重置失敗');
        }
        setIsLoading(false);
    }, [authHeaders, refreshPortfolio]);

    return {
        portfolio,
        trades,
        isLoading,
        error,
        refreshPortfolio,
        refreshTrades,
        placeOrder,
        resetPortfolio,
    };
}
