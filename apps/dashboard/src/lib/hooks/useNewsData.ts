'use client';

import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/AuthContext';
import type {
    NewsArticle,
    NewsSourceConfig,
    NewsAlert,
    NewsDashboardSummary,
    NewsAnalytics,
    NewsTopic,
    NewsSource,
} from '@/lib/news/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// ============ Data Fetching Hooks ============

/**
 * Hook for news articles with filtering
 */
export function useNewsArticles(filters?: {
    source?: NewsSource;
    topic?: NewsTopic;
    symbol?: string;
    keyword?: string;
    dateFrom?: string;
    dateTo?: string;
}) {
    const { getIdToken, user } = useAuth();

    const queryParams = new URLSearchParams();
    if (filters?.source) queryParams.set('source', filters.source);
    if (filters?.topic) queryParams.set('topic', filters.topic);
    if (filters?.symbol) queryParams.set('symbol', filters.symbol);
    if (filters?.keyword) queryParams.set('keyword', filters.keyword);
    if (filters?.dateFrom) queryParams.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) queryParams.set('dateTo', filters.dateTo);

    const queryString = queryParams.toString();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch news');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<{ articles: NewsArticle[]; total: number }>(
        user ? `/api/news/articles${queryString ? `?${queryString}` : ''}` : null,
        fetcher,
        { refreshInterval: 60000 }
    );

    return {
        articles: data?.articles || [],
        total: data?.total || 0,
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for news dashboard summary
 */
export function useNewsDashboard() {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch dashboard');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<NewsDashboardSummary>(
        user ? '/api/news/dashboard' : null,
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
 * Hook for news sources
 */
export function useNewsSources() {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch sources');
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<{ sources: NewsSourceConfig[] }>(
        user ? '/api/news/sources' : null,
        fetcher
    );

    return {
        sources: data?.sources || [],
        isLoading,
        error,
        refresh: mutate,
    };
}

/**
 * Hook for news analytics
 */
export function useNewsAnalytics(period: '24h' | '7d' | '30d' = '7d') {
    const { getIdToken, user } = useAuth();

    const fetcher = async (url: string) => {
        const token = await getIdToken();
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        return res.json();
    };

    const { data, error, isLoading } = useSWR<NewsAnalytics>(
        user ? `/api/news/analytics?period=${period}` : null,
        fetcher
    );

    return {
        analytics: data,
        isLoading,
        error,
    };
}

// ============ Mutation Hooks ============

export function useNewsMutations() {
    const { getIdToken } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const bookmarkArticle = useCallback(async (articleId: string, bookmarked: boolean) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/news/articles/${articleId}/bookmark`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bookmarked }),
            });
            if (!res.ok) throw new Error('Failed to bookmark');
            return res.json();
        } finally {
            setIsSubmitting(false);
        }
    }, [getIdToken]);

    const analyzeArticle = useCallback(async (articleId: string) => {
        setIsSubmitting(true);
        try {
            const token = await getIdToken();
            const res = await fetch(`${API_BASE}/api/news/articles/${articleId}/analyze`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to analyze');
            return res.json();
        } finally {
            setIsSubmitting(false);
        }
    }, [getIdToken]);

    return {
        bookmarkArticle,
        analyzeArticle,
        isSubmitting,
    };
}

// ============ Filter Hook ============

export function useNewsFilter(articles: NewsArticle[]) {
    const [search, setSearch] = useState('');
    const [topic, setTopic] = useState<NewsTopic | 'all'>('all');
    const [source, setSource] = useState<NewsSource | 'all'>('all');
    const [sentiment, setSentiment] = useState<string>('all');

    const filteredArticles = useMemo(() => {
        return articles.filter(article => {
            if (search) {
                const searchLower = search.toLowerCase();
                if (!article.title.toLowerCase().includes(searchLower) &&
                    !article.summary.toLowerCase().includes(searchLower)) {
                    return false;
                }
            }
            if (topic !== 'all' && !article.topics.includes(topic)) return false;
            if (source !== 'all' && article.source !== source) return false;
            if (sentiment !== 'all' && article.sentiment?.sentiment !== sentiment) return false;
            return true;
        });
    }, [articles, search, topic, source, sentiment]);

    const clearFilters = useCallback(() => {
        setSearch('');
        setTopic('all');
        setSource('all');
        setSentiment('all');
    }, []);

    return {
        filteredArticles,
        search, setSearch,
        topic, setTopic,
        source, setSource,
        sentiment, setSentiment,
        clearFilters,
    };
}
