'use client';

import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/AuthContext';
import type {
    Quote,
    WatchlistItem,
    WatchlistGroup,
    MarketSignal,
    MarketDashboardSummary,
    TechnicalIndicators,
    Sector,
    AssetType,
} from '@/lib/market/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// ============ Data Fetching Hooks ============

/**
 * Hook for real-time quotes
 */
export function useQuotes(symbols: string[]) {
    const { getIdToken, user } = useAuth();

    const symbolsStr = symbols.join(',');

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch quotes');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<{ quotes: Quote[] }>(
        user && symbols.length > 0 ? `/api/market/quotes?symbols=${symbolsStr}` : null,
        fetcher,
        { refreshInterval: 10000 }  // 10 seconds for real-time
    );

    return {
        quotes: data?.quotes || [],
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for market dashboard
 */
export function useMarketDashboard() {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch dashboard');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<MarketDashboardSummary>(
        user ? '/api/market/dashboard' : null,
        fetcher,
        { refreshInterval: 30000 }
    );

    return {
        summary: data,
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for watchlist
 */
export function useWatchlist() {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch watchlist');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<{ items: WatchlistItem[]; groups: WatchlistGroup[] }>(
        user ? '/api/market/watchlist' : null,
        fetcher,
        { refreshInterval: 30000 }
    );

    return {
        items: data?.items || [],
        groups: data?.groups || [],
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for market signals
 */
export function useMarketSignals() {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch signals');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<{ signals: MarketSignal[] }>(
        user ? '/api/market/signals' : null,
        fetcher,
        { refreshInterval: 60000 }
    );

    return {
        signals: data?.signals || [],
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for sector heatmap
 */
export function useSectorHeatmap() {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch heatmap');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<{ sectors: Sector[] }>(
        user ? '/api/market/heatmap' : null,
        fetcher,
        { refreshInterval: 60000 }
    );

    return {
        sectors: data?.sectors || [],
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for technical indicators
 */
export function useTechnicalIndicators(symbol: string) {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch indicators');
        return res.json();
    };

    const { data, error, isLoading } = useSWR<TechnicalIndicators>(
        user && symbol ? `/api/market/indicators/${symbol}` : null,
        fetcher
    );

    return {
        indicators: data,
        isLoading,
        error,
    };
}

// ============ Mutation Hooks ============

export function useMarketMutations() {
    const { getIdToken } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addToWatchlist = useCallback(async (symbol: string, group?: string, notes?: string) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/market/watchlist`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ symbol, group, notes }),
            });
            if (!res.ok) throw new Error('Failed to add');
            return res.json();
        } finally {
            setIsSubmitting(false);
        }
    }, [getIdToken]);

    const removeFromWatchlist = useCallback(async (itemId: string) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/market/watchlist/${itemId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to remove');
            return res.json();
        } finally {
            setIsSubmitting(false);
        }
    }, [getIdToken]);

    const dismissSignal = useCallback(async (signalId: string) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/market/signals/${signalId}/dismiss`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to dismiss');
            return res.json();
        } finally {
            setIsSubmitting(false);
        }
    }, [getIdToken]);

    return {
        addToWatchlist,
        removeFromWatchlist,
        dismissSignal,
        isSubmitting,
    };
}

// ============ Filter Hook ============

export function useWatchlistFilter(items: WatchlistItem[]) {
    const [search, setSearch] = useState('');
    const [group, setGroup] = useState<string>('all');
    const [assetType, setAssetType] = useState<AssetType | 'all'>('all');

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            if (search) {
                const searchLower = search.toLowerCase();
                if (!item.symbol.toLowerCase().includes(searchLower) &&
                    !item.name.toLowerCase().includes(searchLower)) {
                    return false;
                }
            }
            if (group !== 'all' && item.group !== group) return false;
            if (assetType !== 'all' && item.type !== assetType) return false;
            return true;
        });
    }, [items, search, group, assetType]);

    const clearFilters = useCallback(() => {
        setSearch('');
        setGroup('all');
        setAssetType('all');
    }, []);

    return {
        filteredItems,
        search, setSearch,
        group, setGroup,
        assetType, setAssetType,
        clearFilters,
    };
}
