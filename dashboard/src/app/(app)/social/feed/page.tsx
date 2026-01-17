'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSocialPosts, usePostFilter } from '@/lib/hooks/useSocialData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSkeleton, AdvancedFilters, QuickFilters } from '@/components/shared';
import type { FilterConfig } from '@/components/shared/AdvancedFilters';
import type { SocialPost, SocialPlatform } from '@/lib/social/types';
import {
    Zap,
    RefreshCw,
    Search,
    Heart,
    MessageCircle,
    Share2,
    ExternalLink,
    Clock,
    CheckCircle,
    TrendingUp,
    Users,
    Hash,
} from 'lucide-react';

const platformOptions = [
    { value: 'facebook', label: 'Facebook', icon: <span>📘</span> },
    { value: 'instagram', label: 'Instagram', icon: <span>📸</span> },
    { value: 'threads', label: 'Threads', icon: <span>🧵</span> },
    { value: 'twitter', label: 'Twitter', icon: <span>🐦</span> },
    { value: 'line', label: 'LINE', icon: <span>💬</span> },
    { value: 'youtube', label: 'YouTube', icon: <span>▶️</span> },
    { value: 'tiktok', label: 'TikTok', icon: <span>🎵</span> },
];

const sentimentOptions = [
    { value: 'positive', label: '🙂 正面' },
    { value: 'negative', label: '😞 負面' },
    { value: 'neutral', label: '😐 中性' },
    { value: 'mixed', label: '🤔 混合' },
];

const engagementOptions = [
    { value: 'high', label: '高互動' },
    { value: 'medium', label: '中互動' },
    { value: 'low', label: '低互動' },
];

const verifiedOptions = [
    { value: 'verified', label: '已驗證帳號' },
    { value: 'unverified', label: '未驗證帳號' },
];

const filterConfigs: FilterConfig[] = [
    { key: 'search', label: '搜尋內容', type: 'search', placeholder: '內容、hashtag 或作者' },
    { key: 'platforms', label: '社群平台', type: 'multi-select', options: platformOptions },
    { key: 'sentiment', label: '情緒分析', type: 'select', options: sentimentOptions },
    { key: 'engagement', label: '互動程度', type: 'select', options: engagementOptions },
    { key: 'verified', label: '帳號驗證', type: 'select', options: verifiedOptions },
    { key: 'date', label: '發布日期', type: 'date-range' },
];

const platformIcons: Record<string, string> = {
    facebook: '📘', instagram: '📸', threads: '🧵',
    line: '💬', twitter: '🐦', tiktok: '🎵', youtube: '▶️',
};

const sentimentColors: Record<string, string> = {
    positive: 'text-green-500 bg-green-50 dark:bg-green-950',
    negative: 'text-red-500 bg-red-50 dark:bg-red-950',
    neutral: 'text-gray-500 bg-gray-50 dark:bg-gray-950',
    mixed: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-950',
};

export default function SocialFeedPage() {
    const { posts, isLoading, refresh } = useSocialPosts();
    const [filters, setFilters] = useState<Record<string, string | string[]>>({});
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [visibleCount, setVisibleCount] = useState(30);
    const loaderRef = useRef<HTMLDivElement>(null);

    // Infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < posts.length) {
                    setVisibleCount(prev => Math.min(prev + 15, posts.length));
                }
            },
            { threshold: 0.1 }
        );
        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [visibleCount, posts.length]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refresh();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleFilterChange = (key: string, value: string | string[]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleClearFilters = () => {
        setFilters({});
    };

    const getEngagementLevel = (post: SocialPost): string => {
        const total = post.engagement.likes + post.engagement.comments + post.engagement.shares;
        if (total > 1000) return 'high';
        if (total > 100) return 'medium';
        return 'low';
    };

    const filteredPosts = useMemo(() => {
        return posts.filter(post => {
            // Search filter
            const search = (filters.search as string)?.toLowerCase();
            if (search) {
                const matchesSearch = post.content.toLowerCase().includes(search) ||
                    post.author.username.toLowerCase().includes(search) ||
                    post.author.displayName.toLowerCase().includes(search) ||
                    post.hashtags?.some(tag => tag.toLowerCase().includes(search));
                if (!matchesSearch) return false;
            }

            // Platform filter
            const platforms = filters.platforms as string[];
            if (platforms?.length > 0 && !platforms.includes(post.platform)) return false;

            // Sentiment filter
            const sentiment = filters.sentiment as string;
            if (sentiment && sentiment !== 'all' && post.sentiment?.label !== sentiment) return false;

            // Engagement filter
            const engagement = filters.engagement as string;
            if (engagement && engagement !== 'all' && getEngagementLevel(post) !== engagement) return false;

            // Verified filter
            const verified = filters.verified as string;
            if (verified && verified !== 'all') {
                if (verified === 'verified' && !post.author.isVerified) return false;
                if (verified === 'unverified' && post.author.isVerified) return false;
            }

            // Date range filter
            const startDate = filters.date_start as string;
            const endDate = filters.date_end as string;
            if (startDate || endDate) {
                const postDate = new Date(post.publishedAt);
                if (startDate && postDate < new Date(startDate)) return false;
                if (endDate && postDate > new Date(endDate + 'T23:59:59')) return false;
            }

            return true;
        });
    }, [posts, filters]);

    const visiblePosts = filteredPosts.slice(0, visibleCount);

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return '剛剛';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`;
        return date.toLocaleDateString('zh-TW');
    };

    // Stats
    const stats = useMemo(() => {
        const totalPosts = filteredPosts.length;
        const totalEngagement = filteredPosts.reduce((sum, p) =>
            sum + p.engagement.likes + p.engagement.comments + p.engagement.shares, 0);
        const verifiedPosts = filteredPosts.filter(p => p.author.isVerified).length;
        const sentimentBreakdown = {
            positive: filteredPosts.filter(p => p.sentiment?.label === 'positive').length,
            negative: filteredPosts.filter(p => p.sentiment?.label === 'negative').length,
        };
        return { totalPosts, totalEngagement, verifiedPosts, sentimentBreakdown };
    }, [filteredPosts]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Zap className="h-6 w-6 text-yellow-500" />
                        即時動態
                    </h1>
                    <p className="text-muted-foreground">社群貼文即時串流</p>
                </div>
                <LoadingSkeleton type="card" count={5} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Zap className="h-6 w-6 text-yellow-500" />
                        即時動態
                    </h1>
                    <p className="text-muted-foreground">
                        共 {stats.totalPosts} 則貼文 · 總互動 {stats.totalEngagement.toLocaleString()}
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    更新
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-3 md:grid-cols-4">
                <Card className="p-3">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        <div>
                            <div className="text-xl font-bold">{stats.totalPosts}</div>
                            <div className="text-xs text-muted-foreground">貼文數</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-red-500" />
                        <div>
                            <div className="text-xl font-bold">{stats.totalEngagement.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">總互動</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        <div>
                            <div className="text-xl font-bold">{stats.sentimentBreakdown.positive}</div>
                            <div className="text-xs text-muted-foreground">正面貼文</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-blue-500" />
                        <div>
                            <div className="text-xl font-bold">{stats.verifiedPosts}</div>
                            <div className="text-xs text-muted-foreground">驗證帳號</div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Quick Filters */}
            <QuickFilters
                options={platformOptions}
                selected={(filters.quickPlatform as string) || 'all'}
                onChange={(v) => {
                    if (v === 'all') {
                        setFilters(prev => ({ ...prev, platforms: [], quickPlatform: 'all' }));
                    } else {
                        setFilters(prev => ({ ...prev, platforms: [v], quickPlatform: v }));
                    }
                }}
            />

            {/* Advanced Filters */}
            <AdvancedFilters
                configs={filterConfigs}
                values={filters}
                onChange={handleFilterChange}
                onClear={handleClearFilters}
                totalCount={posts.length}
                filteredCount={filteredPosts.length}
            />

            {/* Feed */}
            <div className="space-y-3">
                {visiblePosts.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>沒有符合條件的貼文</p>
                            <Button variant="link" onClick={handleClearFilters}>
                                清除篩選條件
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    visiblePosts.map((post) => (
                        <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex gap-4">
                                    {/* Platform indicator */}
                                    <div className="text-2xl">
                                        {platformIcons[post.platform] || '📱'}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        {/* Author row */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-semibold">
                                                {post.author.displayName}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                @{post.author.username}
                                            </span>
                                            {post.author.isVerified && (
                                                <CheckCircle className="h-4 w-4 text-blue-500" />
                                            )}
                                            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatTime(post.publishedAt)}
                                            </span>
                                        </div>

                                        {/* Content */}
                                        <p className="text-sm mb-3 whitespace-pre-wrap">
                                            {post.content}
                                        </p>

                                        {/* Hashtags */}
                                        {post.hashtags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {post.hashtags.slice(0, 5).map((tag) => (
                                                    <Badge key={tag} variant="secondary" className="text-xs">
                                                        #{tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}

                                        {/* Footer */}
                                        <div className="flex items-center gap-4 text-sm">
                                            {/* Engagement */}
                                            <div className="flex items-center gap-4 text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Heart className="h-4 w-4" />
                                                    {post.engagement.likes.toLocaleString()}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <MessageCircle className="h-4 w-4" />
                                                    {post.engagement.comments.toLocaleString()}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Share2 className="h-4 w-4" />
                                                    {post.engagement.shares.toLocaleString()}
                                                </span>
                                            </div>

                                            {/* Sentiment */}
                                            {post.sentiment && (
                                                <Badge
                                                    variant="outline"
                                                    className={sentimentColors[post.sentiment.label]}
                                                >
                                                    {post.sentiment.label === 'positive' ? '正面' :
                                                        post.sentiment.label === 'negative' ? '負面' :
                                                            post.sentiment.label === 'mixed' ? '混合' : '中性'}
                                                    ({(post.sentiment.confidence * 100).toFixed(0)}%)
                                                </Badge>
                                            )}

                                            {/* Severity */}
                                            {post.severity && post.severity > 50 && (
                                                <Badge variant="destructive">
                                                    嚴重度 {post.severity}
                                                </Badge>
                                            )}

                                            {/* Source link */}
                                            <a
                                                href={post.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-auto text-muted-foreground hover:text-foreground"
                                                aria-label="查看原文"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Loader */}
            {visibleCount < filteredPosts.length && (
                <div ref={loaderRef} className="flex justify-center py-4">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            )}
        </div>
    );
}
