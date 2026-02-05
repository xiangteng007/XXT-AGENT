'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useNewsDashboard, useNewsArticles } from '@/lib/hooks/useNewsData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton, SeverityBadge } from '@/components/shared';
import {
    Newspaper,
    TrendingUp,
    TrendingDown,
    Minus,
    Zap,
    AlertTriangle,
    BarChart3,
    ArrowRight,
    ExternalLink,
    Sparkles,
    Globe,
    Clock,
} from 'lucide-react';

const sourceIcons: Record<string, string> = {
    reuters: '📰',
    bloomberg: '💹',
    wsj: '📊',
    cnbc: '📺',
    yahoo: '🔮',
    google: '🔍',
    local: '🏠',
    other: '📋',
};

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

const sentimentConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    bullish: { label: '看漲', color: 'text-green-500', icon: <TrendingUp className="h-4 w-4" /> },
    bearish: { label: '看跌', color: 'text-red-500', icon: <TrendingDown className="h-4 w-4" /> },
    neutral: { label: '中性', color: 'text-gray-500', icon: <Minus className="h-4 w-4" /> },
    mixed: { label: '混合', color: 'text-yellow-500', icon: <Zap className="h-4 w-4" /> },
};

export default function NewsDashboardPage() {
    const { summary, isLoading } = useNewsDashboard();
    const { articles } = useNewsArticles();

    const recentArticles = useMemo(() => {
        return articles.slice(0, 5);
    }, [articles]);

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

    const getTrendIcon = (trend: number) => {
        if (trend > 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
        if (trend < -5) return <TrendingDown className="h-4 w-4 text-red-500" />;
        return <Minus className="h-4 w-4 text-gray-400" />;
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">新聞監控</h1>
                    <p className="text-muted-foreground">財經新聞即時追蹤與 AI 分析</p>
                </div>
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
                        <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20">
                            <Newspaper className="h-6 w-6 text-gold" />
                        </div>
                        新聞監控
                    </h1>
                    <p className="text-muted-foreground">財經新聞即時追蹤與 AI 分析</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/news/feed">
                            <Zap className="h-4 w-4 mr-2" />
                            即時新聞
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/news/analysis">
                            <Sparkles className="h-4 w-4 mr-2" />
                            AI 分析
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-stagger">
                {/* 今日新聞 - Blue accent */}
                <Card className="bg-card border-blue-500/30 relative overflow-hidden card-glow card-lift cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">今日新聞</CardTitle>
                        <div className="p-2 rounded-lg bg-blue-500/20">
                            <Newspaper className="h-4 w-4 text-blue-400" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold text-foreground tracking-tight">
                            {summary?.todayArticles ?? 0}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                            {getTrendIcon(summary?.articlesTrend ?? 0)}
                            <span className="text-xs text-blue-400">
                                {(summary?.articlesTrend ?? 0) >= 0 ? '+' : ''}{summary?.articlesTrend ?? 0}% vs 昨日
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* 重大新聞 - Red accent */}
                <Card className="bg-card border-red-500/30 relative overflow-hidden card-glow card-lift cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">重大新聞</CardTitle>
                        <div className="p-2 rounded-lg bg-red-500/20">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold text-foreground tracking-tight">
                            {summary?.todayHighImpact ?? 0}
                        </div>
                        <span className="text-xs text-red-400">
                            需要關注的重大事件
                        </span>
                    </CardContent>
                </Card>

                {/* 整體情緒 - Emerald accent */}
                <Card className="bg-card border-emerald-500/30 relative overflow-hidden card-glow card-lift cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">整體情緒</CardTitle>
                        <div className="p-2 rounded-lg bg-emerald-500/20">
                            {summary?.overallSentiment && sentimentConfig[summary.overallSentiment]?.icon}
                        </div>
                    </CardHeader>
                    <CardContent className="relative">
                        <div className={`text-4xl font-bold ${sentimentConfig[summary?.overallSentiment ?? 'neutral']?.color || 'text-foreground'}`}>
                            {sentimentConfig[summary?.overallSentiment ?? 'neutral']?.label || '中性'}
                        </div>
                        <span className="text-xs text-emerald-400">
                            情緒分數 {((summary?.sentimentScore ?? 0) * 100).toFixed(0)}
                        </span>
                    </CardContent>
                </Card>

                {/* 監控狀態 - Purple accent */}
                <Card className="bg-card border-purple-500/30 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">監控狀態</CardTitle>
                        <div className="p-2 rounded-lg bg-purple-500/20">
                            <Globe className="h-4 w-4 text-purple-400" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold text-foreground tracking-tight">
                            {summary?.activeSources ?? 0}
                        </div>
                        <span className="text-xs text-purple-400">
                            個來源 / {summary?.activeAlerts ?? 0} 個警報
                        </span>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Top Stories */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>最新頭條</CardTitle>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/news/feed">
                                    查看全部 <ArrowRight className="h-4 w-4 ml-1" />
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {(summary?.topStories || recentArticles).slice(0, 5).map((article) => (
                                    <div key={article.id} className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                        <div className="text-2xl">
                                            {sourceIcons[article.source] || '📰'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs text-muted-foreground">
                                                    {article.sourceName}
                                                </span>
                                                {article.topics?.slice(0, 2).map(t => (
                                                    <Badge key={t} variant="outline" className={`text-xs ${topicLabels[t]?.color || ''}`}>
                                                        {topicLabels[t]?.label || t}
                                                    </Badge>
                                                ))}
                                                {article.severity && article.severity > 70 && (
                                                    <SeverityBadge severity={article.severity} size="sm" />
                                                )}
                                            </div>
                                            <h3 className="font-medium text-sm line-clamp-1">{article.title}</h3>
                                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                                {article.summary}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatTime(article.publishedAt)}
                                                </span>
                                                {article.sentiment && (
                                                    <span className={`flex items-center gap-1 ${sentimentConfig[article.sentiment.sentiment]?.color}`}>
                                                        {sentimentConfig[article.sentiment.sentiment]?.icon}
                                                        {sentimentConfig[article.sentiment.sentiment]?.label}
                                                    </span>
                                                )}
                                                {article.symbols?.slice(0, 2).map(s => (
                                                    <Badge key={s} variant="secondary" className="text-xs">
                                                        {s}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <a
                                            href={article.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-muted-foreground hover:text-foreground self-start"
                                            title="查看原文"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Trending Symbols */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">熱門標的</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(summary?.trendingSymbols || []).slice(0, 6).map((item, idx) => (
                                    <div key={item.symbol} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 text-center text-muted-foreground text-xs font-bold">
                                                {idx + 1}
                                            </span>
                                            <Badge variant="outline">{item.symbol}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={sentimentConfig[item.sentiment]?.color}>
                                                {sentimentConfig[item.sentiment]?.icon}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {item.count} 則
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {(summary?.trendingSymbols || []).length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        無趨勢資料
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Trending Topics */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">熱門主題</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {(summary?.trendingTopics || []).map((item) => (
                                    <Badge
                                        key={item.topic}
                                        className={topicLabels[item.topic]?.color || ''}
                                    >
                                        {topicLabels[item.topic]?.label || item.topic} ({item.count})
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">快速導航</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className="justify-start" asChild>
                                <Link href="/news/sources">
                                    <Globe className="h-4 w-4 mr-2" />
                                    來源管理
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start" asChild>
                                <Link href="/news/alerts">
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    警報設定
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start col-span-2" asChild>
                                <Link href="/news/analysis">
                                    <BarChart3 className="h-4 w-4 mr-2" />
                                    分析報表
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
