'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useNewsArticles, useNewsMutations } from '@/lib/hooks/useNewsData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSkeleton, SeverityBadge, AdvancedFilters, QuickFilters } from '@/components/shared';
import type { FilterConfig } from '@/components/shared/AdvancedFilters';
import type { NewsArticle, NewsTopic, NewsSource } from '@/lib/news/types';
import {
    Newspaper,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Minus,
    ExternalLink,
    Bookmark,
    BookmarkCheck,
    Search,
    Clock,
    Zap,
} from 'lucide-react';

const sourceOptions = [
    { value: 'reuters', label: 'Reuters', icon: <span>📰</span> },
    { value: 'bloomberg', label: 'Bloomberg', icon: <span>💹</span> },
    { value: 'cnbc', label: 'CNBC', icon: <span>📺</span> },
    { value: 'wsj', label: 'WSJ', icon: <span>📊</span> },
    { value: 'yahoo', label: 'Yahoo Finance', icon: <span>🔮</span> },
    { value: 'local', label: '本地新聞', icon: <span>🏠</span> },
];

const topicOptions = [
    { value: 'earnings', label: '財報' },
    { value: 'merger', label: '併購' },
    { value: 'regulation', label: '監管' },
    { value: 'macro', label: '總經' },
    { value: 'tech', label: '科技' },
    { value: 'crypto', label: '加密貨幣' },
    { value: 'commodity', label: '大宗商品' },
    { value: 'forex', label: '外匯' },
];

const sentimentOptions = [
    { value: 'bullish', label: '看漲', icon: <TrendingUp className="h-3 w-3 text-green-500" /> },
    { value: 'bearish', label: '看跌', icon: <TrendingDown className="h-3 w-3 text-red-500" /> },
    { value: 'neutral', label: '中性', icon: <Minus className="h-3 w-3 text-gray-500" /> },
];

const impactOptions = [
    { value: 'high', label: '高影響' },
    { value: 'medium', label: '中影響' },
    { value: 'low', label: '低影響' },
];

const filterConfigs: FilterConfig[] = [
    { key: 'search', label: '關鍵字搜尋', type: 'search', placeholder: '標題、摘要或股票代號' },
    { key: 'sources', label: '新聞來源', type: 'multi-select', options: sourceOptions },
    { key: 'topics', label: '主題分類', type: 'multi-select', options: topicOptions },
    { key: 'sentiment', label: '市場情緒', type: 'select', options: sentimentOptions },
    { key: 'impact', label: '影響程度', type: 'select', options: impactOptions },
    { key: 'date', label: '日期範圍', type: 'date-range' },
];

const topicLabels: Record<string, { label: string; color: string }> = {
    earnings: { label: '財報', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    merger: { label: '併購', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    regulation: { label: '監管', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
    macro: { label: '總經', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    tech: { label: '科技', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
    crypto: { label: '加密貨幣', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
    commodity: { label: '大宗商品', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    forex: { label: '外匯', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300' },
    politics: { label: '政治', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300' },
    other: { label: '其他', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300' },
};

const sentimentIcons: Record<string, { icon: React.ReactNode; color: string }> = {
    bullish: { icon: <TrendingUp className="h-4 w-4" />, color: 'text-green-500' },
    bearish: { icon: <TrendingDown className="h-4 w-4" />, color: 'text-red-500' },
    neutral: { icon: <Minus className="h-4 w-4" />, color: 'text-gray-400' },
    mixed: { icon: <Zap className="h-4 w-4" />, color: 'text-yellow-500' },
};

export default function NewsFeedPage() {
    const { articles, isLoading, refresh } = useNewsArticles();
    const { bookmarkArticle } = useNewsMutations();

    const [filters, setFilters] = useState<Record<string, string | string[]>>({});
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
    const [visibleCount, setVisibleCount] = useState(20);
    const loaderRef = useRef<HTMLDivElement>(null);

    // Infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < articles.length) {
                    setVisibleCount(prev => Math.min(prev + 10, articles.length));
                }
            },
            { threshold: 0.1 }
        );

        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [visibleCount, articles.length]);

    const handleFilterChange = (key: string, value: string | string[]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleClearFilters = () => {
        setFilters({});
    };

    const filteredArticles = useMemo(() => {
        return articles.filter(a => {
            // Search filter
            const search = (filters.search as string)?.toLowerCase();
            if (search) {
                const matchesSearch = a.title.toLowerCase().includes(search) ||
                    a.summary.toLowerCase().includes(search) ||
                    a.symbols?.some(sym => sym.toLowerCase().includes(search));
                if (!matchesSearch) return false;
            }

            // Source filter
            const sources = filters.sources as string[];
            if (sources?.length > 0 && !sources.includes(a.source)) return false;

            // Topics filter
            const topics = filters.topics as string[];
            if (topics?.length > 0 && !a.topics?.some(t => topics.includes(t))) return false;

            // Sentiment filter
            const sentiment = filters.sentiment as string;
            if (sentiment && sentiment !== 'all' && a.sentiment?.sentiment !== sentiment) return false;

            // Impact filter
            const impact = filters.impact as string;
            if (impact && impact !== 'all' && a.impact?.level !== impact) return false;

            // Date range filter
            const startDate = filters.date_start as string;
            const endDate = filters.date_end as string;
            if (startDate || endDate) {
                const articleDate = new Date(a.publishedAt);
                if (startDate && articleDate < new Date(startDate)) return false;
                if (endDate && articleDate > new Date(endDate + 'T23:59:59')) return false;
            }

            return true;
        });
    }, [articles, filters]);

    const visibleArticles = filteredArticles.slice(0, visibleCount);

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return '剛剛';
        if (diffMins < 60) return `${diffMins} 分鐘前`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} 小時前`;
        return date.toLocaleDateString('zh-TW');
    };

    const handleBookmark = async (article: NewsArticle, e: React.MouseEvent) => {
        e.stopPropagation();
        const isBookmarked = bookmarkedIds.has(article.id);

        setBookmarkedIds(prev => {
            const newSet = new Set(prev);
            if (isBookmarked) newSet.delete(article.id);
            else newSet.add(article.id);
            return newSet;
        });

        await bookmarkArticle(article.id, !isBookmarked);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">即時新聞</h1>
                <LoadingSkeleton type="card" count={6} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Newspaper className="h-6 w-6" />
                        即時新聞
                    </h1>
                    <p className="text-muted-foreground">
                        {articles.length} 則新聞 · 自動更新中
                    </p>
                </div>
                <Button variant="outline" onClick={() => refresh()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    刷新
                </Button>
            </div>

            {/* Quick Filters */}
            <QuickFilters
                options={topicOptions}
                selected={(filters.quickTopic as string) || 'all'}
                onChange={(v) => {
                    if (v === 'all') {
                        setFilters(prev => ({ ...prev, topics: [], quickTopic: 'all' }));
                    } else {
                        setFilters(prev => ({ ...prev, topics: [v], quickTopic: v }));
                    }
                }}
            />

            {/* Advanced Filters */}
            <AdvancedFilters
                configs={filterConfigs}
                values={filters}
                onChange={handleFilterChange}
                onClear={handleClearFilters}
                totalCount={articles.length}
                filteredCount={filteredArticles.length}
            />

            {/* Feed */}
            <div className="space-y-4">
                {visibleArticles.map((article) => {
                    const isExpanded = expandedId === article.id;
                    const isBookmarked = bookmarkedIds.has(article.id) || article.isBookmarked;
                    const sentimentInfo = article.sentiment?.sentiment
                        ? sentimentIcons[article.sentiment.sentiment]
                        : null;

                    return (
                        <Card
                            key={article.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${isExpanded ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => setExpandedId(isExpanded ? null : article.id)}
                        >
                            <CardContent className="p-4">
                                <div className="flex gap-4">
                                    {/* Thumbnail */}
                                    {article.imageUrl && (
                                        <div className="hidden md:block flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted">
                                            <img
                                                src={article.imageUrl}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className={`font-semibold ${isExpanded ? '' : 'line-clamp-2'}`}>
                                                {article.title}
                                            </h3>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="flex-shrink-0 h-8 w-8"
                                                onClick={(e) => handleBookmark(article, e)}
                                                aria-label={isBookmarked ? '取消收藏' : '收藏'}
                                            >
                                                {isBookmarked ? (
                                                    <BookmarkCheck className="h-4 w-4 text-primary" />
                                                ) : (
                                                    <Bookmark className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>

                                        <p className={`text-sm text-muted-foreground mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                            {article.summary}
                                        </p>

                                        {/* Meta */}
                                        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                                            <span className="text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatTime(article.publishedAt)}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {article.sourceName}
                                            </span>
                                            {sentimentInfo && (
                                                <span className={`flex items-center gap-1 ${sentimentInfo.color}`}>
                                                    {sentimentInfo.icon}
                                                </span>
                                            )}
                                            {article.severity && article.severity >= 70 && (
                                                <SeverityBadge severity={article.severity} />
                                            )}
                                        </div>

                                        {/* Tags */}
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {article.topics?.slice(0, 3).map(topic => {
                                                const topicInfo = topicLabels[topic] || topicLabels.other;
                                                return (
                                                    <Badge
                                                        key={topic}
                                                        variant="secondary"
                                                        className={`text-xs ${topicInfo.color}`}
                                                    >
                                                        {topicInfo.label}
                                                    </Badge>
                                                );
                                            })}
                                            {article.symbols?.slice(0, 3).map(symbol => (
                                                <Badge key={symbol} variant="outline" className="text-xs">
                                                    ${symbol}
                                                </Badge>
                                            ))}
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="mt-4 pt-4 border-t space-y-3">
                                                {article.content && (
                                                    <p className="text-sm">{article.content}</p>
                                                )}
                                                {article.sentiment?.aiSummary && (
                                                    <div className="p-3 bg-muted/50 rounded-lg">
                                                        <div className="text-xs font-medium text-muted-foreground mb-1">
                                                            AI 摘要
                                                        </div>
                                                        <p className="text-sm">{article.sentiment.aiSummary}</p>
                                                    </div>
                                                )}
                                                <a
                                                    href={article.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                    aria-label="查看原文"
                                                >
                                                    查看原文
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Loader */}
            {visibleCount < filteredArticles.length && (
                <div ref={loaderRef} className="flex justify-center py-4">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            )}

            {filteredArticles.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>沒有符合篩選條件的新聞</p>
                    <Button variant="link" onClick={handleClearFilters}>
                        清除篩選條件
                    </Button>
                </div>
            )}
        </div>
    );
}
