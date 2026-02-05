'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/AuthContext';
import type { Portfolio, Position, Transaction } from '@/lib/types/portfolio';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

/**
 * Hook for managing portfolio data
 */
export function usePortfolio(portfolioId?: string) {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch portfolio');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<{ portfolio: Portfolio }>(
        user && portfolioId ? `/api/portfolio/${portfolioId}` : null,
        fetcher,
        { refreshInterval: 30000 }
    );

    // Calculate derived values
    const summary = useMemo(() => {
        if (!data?.portfolio) return null;
        const p = data.portfolio;
        return {
            totalValue: p.totalValue,
            totalCost: p.totalCost,
            totalPnL: p.totalPnL,
            totalPnLPct: p.totalPnLPct,
            dailyPnL: p.dailyPnL,
            dailyPnLPct: p.dailyPnLPct,
            positionCount: p.positions.length,
            cashBalance: p.cashBalance,
        };
    }, [data?.portfolio]);

    return {
        portfolio: data?.portfolio,
        summary,
        isLoading,
        error,
        mutate,
    };
}

/**
 * Hook for listing all portfolios
 */
export function usePortfolios() {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch portfolios');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<{ portfolios: Portfolio[] }>(
        user ? '/api/portfolios' : null,
        fetcher
    );

    return {
        portfolios: data?.portfolios || [],
        isLoading,
        error,
        mutate,
    };
}

/**
 * Hook for portfolio mutations (add/remove positions, transactions)
 */
export function usePortfolioMutations(portfolioId: string) {
    const { getIdToken } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addPosition = async (position: Omit<Position, 'id' | 'weight' | 'lastUpdated'>) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/portfolio/${portfolioId}/positions`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(position),
            });
            if (!res.ok) throw new Error('Failed to add position');
            return res.json();
        } finally {
            setIsSubmitting(false);
        }
    };

    const updatePosition = async (positionId: string, updates: Partial<Position>) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/portfolio/${portfolioId}/positions/${positionId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error('Failed to update position');
            return res.json();
        } finally {
            setIsSubmitting(false);
        }
    };

    const removePosition = async (positionId: string) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/portfolio/${portfolioId}/positions/${positionId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to remove position');
            return true;
        } finally {
            setIsSubmitting(false);
        }
    };

    const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/portfolio/${portfolioId}/transactions`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(transaction),
            });
            if (!res.ok) throw new Error('Failed to add transaction');
            return res.json();
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        addPosition,
        updatePosition,
        removePosition,
        addTransaction,
        isSubmitting,
    };
}
