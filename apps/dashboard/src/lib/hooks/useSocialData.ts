'use client';

import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/AuthContext';
import type {
    SocialPost,
    SocialPlatform,
    TrackedAccount,
    MonitorKeyword,
    AlertRule,
    SocialAnalytics,
    SocialDashboardSummary,
} from '@/lib/social/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// ============ Data Fetching Hooks ============

/**
 * Hook for social posts with filtering
 */
export function useSocialPosts(filters?: {
    platform?: SocialPlatform;
    keyword?: string;
    minEngagement?: number;
    sentiment?: string;
    dateFrom?: string;
    dateTo?: string;
}) {
    const { getIdToken, user } = useAuth();

    const queryParams = new URLSearchParams();
    if (filters?.platform) queryParams.set('platform', filters.platform);
    if (filters?.keyword) queryParams.set('keyword', filters.keyword);
    if (filters?.minEngagement) queryParams.set('minEngagement', String(filters.minEngagement));
    if (filters?.sentiment) queryParams.set('sentiment', filters.sentiment);
    if (filters?.dateFrom) queryParams.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) queryParams.set('dateTo', filters.dateTo);

    const queryString = queryParams.toString();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch posts');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<{ posts: SocialPost[]; total: number }>(
        user ? `/api/social/posts${queryString ? `?${queryString}` : ''}` : null,
        fetcher,
        { refreshInterval: 30000 }
    );

    return {
        posts: data?.posts || [],
        total: data?.total || 0,
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for tracked accounts
 */
export function useTrackedAccounts() {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch accounts');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<{ accounts: TrackedAccount[] }>(
        user ? '/api/social/accounts' : null,
        fetcher
    );

    return {
        accounts: data?.accounts || [],
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for keywords
 */
export function useMonitorKeywords() {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch keywords');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<{ keywords: MonitorKeyword[] }>(
        user ? '/api/social/keywords' : null,
        fetcher
    );

    return {
        keywords: data?.keywords || [],
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for dashboard summary
 */
export function useSocialDashboard() {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch dashboard');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<SocialDashboardSummary>(
        user ? '/api/social/dashboard' : null,
        fetcher,
        { refreshInterval: 60000 }
    );

    return {
        summary: data,
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for analytics data
 */
export function useSocialAnalytics(period: '24h' | '7d' | '30d' = '7d') {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        return res.json();
    };

    const { data, error, isLoading } = useSWR<SocialAnalytics>(
        user ? `/api/social/analytics?period=${period}` : null,
        fetcher
    );

    return {
        analytics: data,
        isLoading,
        error,
    };
}

// ============ Mutation Hooks ============

/**
 * Hook for social data mutations
 */
export function useSocialMutations() {
    const { getIdToken } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addKeyword = useCallback(async (keyword: Omit<MonitorKeyword, 'id' | 'createdAt' | 'hitCount'>) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/social/keywords`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(keyword),
            });
            if (!res.ok) throw new Error('Failed to add keyword');
            return res.json();
        } finally {
            setIsSubmitting(false);
        }
    }, [getIdToken]);

    const deleteKeyword = useCallback(async (id: string) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/social/keywords/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to delete keyword');
            return true;
        } finally {
            setIsSubmitting(false);
        }
    }, [getIdToken]);

    const addAccount = useCallback(async (account: Omit<TrackedAccount, 'id' | 'createdAt' | 'lastCheckedAt'>) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/social/accounts`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(account),
            });
            if (!res.ok) throw new Error('Failed to add account');
            return res.json();
        } finally {
            setIsSubmitting(false);
        }
    }, [getIdToken]);

    const deleteAccount = useCallback(async (id: string) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/social/accounts/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to delete account');
            return true;
        } finally {
            setIsSubmitting(false);
        }
    }, [getIdToken]);

    return {
        addKeyword,
        deleteKeyword,
        addAccount,
        deleteAccount,
        isSubmitting,
    };
}

// ============ Utility Hooks ============

/**
 * Hook for post filtering (client-side)
 */
export function usePostFilter(posts: SocialPost[]) {
    const [search, setSearch] = useState('');
    const [platform, setPlatform] = useState<SocialPlatform | 'all'>('all');
    const [sentiment, setSentiment] = useState<string>('all');
    const [minEngagement, setMinEngagement] = useState(0);

    const filteredPosts = useMemo(() => {
        return posts.filter(post => {
            // Search filter
            if (search) {
                const searchLower = search.toLowerCase();
                const matchesContent = post.content.toLowerCase().includes(searchLower);
                const matchesAuthor = post.author.username.toLowerCase().includes(searchLower);
                if (!matchesContent && !matchesAuthor) return false;
            }

            // Platform filter
            if (platform !== 'all' && post.platform !== platform) return false;

            // Sentiment filter
            if (sentiment !== 'all' && post.sentiment?.label !== sentiment) return false;

            // Engagement filter
            if (post.engagement.total < minEngagement) return false;

            return true;
        });
    }, [posts, search, platform, sentiment, minEngagement]);

    const clearFilters = useCallback(() => {
        setSearch('');
        setPlatform('all');
        setSentiment('all');
        setMinEngagement(0);
    }, []);

    return {
        filteredPosts,
        search,
        setSearch,
        platform,
        setPlatform,
        sentiment,
        setSentiment,
        minEngagement,
        setMinEngagement,
        clearFilters,
    };
}
