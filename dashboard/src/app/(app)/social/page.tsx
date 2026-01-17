'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSocialDashboard, useSocialPosts } from '@/lib/hooks/useSocialData';
import { calculateSentimentSummary } from '@/lib/social/sentiment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/shared';
import {
    MessageSquare,
    TrendingUp,
    TrendingDown,
    Minus,
    Heart,
    Users,
    Hash,
    Bell,
    BarChart3,
    Zap,
    ArrowRight,
    Smile,
    Frown,
    Meh,
    Activity,
} from 'lucide-react';

const platformColors: Record<string, string> = {
    facebook: 'bg-blue-500',
    instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
    threads: 'bg-gray-800',
    line: 'bg-green-500',
    twitter: 'bg-sky-400',
    tiktok: 'bg-gray-900',
    youtube: 'bg-red-500',
};

export default function SocialDashboardPage() {
    const { summary, isLoading } = useSocialDashboard();
    const { posts } = useSocialPosts();

    const sentimentSummary = useMemo(() => {
        return calculateSentimentSummary(posts);
    }, [posts]);

    const getSentimentIcon = (label: string) => {
        switch (label) {
            case 'positive': return <Smile className="h-5 w-5 text-green-500" />;
            case 'negative': return <Frown className="h-5 w-5 text-red-500" />;
            case 'mixed': return <Activity className="h-5 w-5 text-yellow-500" />;
            default: return <Meh className="h-5 w-5 text-gray-500" />;
        }
    };

    const getTrendIcon = (trend: number) => {
        if (trend > 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
        if (trend < -5) return <TrendingDown className="h-4 w-4 text-red-500" />;
        return <Minus className="h-4 w-4 text-gray-400" />;
    };

    const formatTrend = (trend: number) => {
        const sign = trend >= 0 ? '+' : '';
        return `${sign}${trend.toFixed(1)}%`;
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">社群監控</h1>
                    <p className="text-muted-foreground">即時社群動態與情緒分析</p>
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
                    <h1 className="text-2xl font-bold">社群監控</h1>
                    <p className="text-muted-foreground">即時社群動態與情緒分析</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/social/feed">
                            <Zap className="h-4 w-4 mr-2" />
                            即時動態
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/social/analytics">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            分析報表
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">今日貼文</CardTitle>
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                            {summary?.todayPosts ?? 0}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                            {getTrendIcon(summary?.postsTrend ?? 0)}
                            <span className="text-xs text-muted-foreground">
                                {formatTrend(summary?.postsTrend ?? 0)} vs 昨日
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900 border-pink-200 dark:border-pink-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">總互動數</CardTitle>
                        <Heart className="h-4 w-4 text-pink-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-pink-700 dark:text-pink-300">
                            {(summary?.todayEngagement ?? 0).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                            {getTrendIcon(summary?.engagementTrend ?? 0)}
                            <span className="text-xs text-muted-foreground">
                                {formatTrend(summary?.engagementTrend ?? 0)} vs 昨日
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">今日警報</CardTitle>
                        <Bell className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                            {summary?.todayAlerts ?? 0}
                        </div>
                        <span className="text-xs text-muted-foreground">
                            需要關注的事件
                        </span>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">整體情緒</CardTitle>
                        {getSentimentIcon(sentimentSummary.overall)}
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                            {sentimentSummary.overall === 'positive' ? '正面' :
                                sentimentSummary.overall === 'negative' ? '負面' :
                                    sentimentSummary.overall === 'mixed' ? '混合' : '中性'}
                        </div>
                        <span className="text-xs text-muted-foreground">
                            信心度 {(sentimentSummary.confidence * 100).toFixed(0)}%
                        </span>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Recent Posts */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>最新貼文</CardTitle>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/social/feed">
                                    查看全部 <ArrowRight className="h-4 w-4 ml-1" />
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {(summary?.recentPosts || posts.slice(0, 5)).map((post) => (
                                    <div key={post.id} className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                        <div className={`w-1 rounded-full ${platformColors[post.platform] || 'bg-gray-400'}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm truncate">
                                                    {post.author.displayName}
                                                </span>
                                                <Badge variant="outline" className="text-xs">
                                                    {post.platform}
                                                </Badge>
                                                {post.sentiment && (
                                                    <Badge
                                                        variant={post.sentiment.label === 'positive' ? 'default' :
                                                            post.sentiment.label === 'negative' ? 'destructive' : 'secondary'}
                                                        className="text-xs"
                                                    >
                                                        {post.sentiment.label}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {post.content}
                                            </p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                <span>❤️ {post.engagement.likes.toLocaleString()}</span>
                                                <span>💬 {post.engagement.comments.toLocaleString()}</span>
                                                <span>🔄 {post.engagement.shares.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Stats Sidebar */}
                <div className="space-y-4">
                    {/* Monitoring Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">監控狀態</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Hash className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">監控關鍵字</span>
                                </div>
                                <Badge variant="secondary">{summary?.activeKeywords ?? 0}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">追蹤帳號</span>
                                </div>
                                <Badge variant="secondary">{summary?.trackedAccounts ?? 0}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Bell className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">警報規則</span>
                                </div>
                                <Badge variant="secondary">{summary?.activeAlertRules ?? 0}</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sentiment Distribution */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">情緒分布</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(['positive', 'neutral', 'negative', 'mixed'] as const).map((label) => {
                                    const count = sentimentSummary.distribution[label];
                                    const total = Object.values(sentimentSummary.distribution).reduce((a, b) => a + b, 0);
                                    const pct = total > 0 ? (count / total) * 100 : 0;

                                    return (
                                        <div key={label} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="capitalize">{label === 'positive' ? '正面' : label === 'negative' ? '負面' : label === 'mixed' ? '混合' : '中性'}</span>
                                                <span className="text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${label === 'positive' ? 'bg-green-500' :
                                                            label === 'negative' ? 'bg-red-500' :
                                                                label === 'mixed' ? 'bg-yellow-500' : 'bg-gray-400'
                                                        }`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Links */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">快速導航</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className="justify-start" asChild>
                                <Link href="/social/sentiment">
                                    <Activity className="h-4 w-4 mr-2" />
                                    情緒分析
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start" asChild>
                                <Link href="/social/accounts">
                                    <Users className="h-4 w-4 mr-2" />
                                    帳號追蹤
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start" asChild>
                                <Link href="/social/settings">
                                    <Hash className="h-4 w-4 mr-2" />
                                    關鍵字
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start" asChild>
                                <Link href="/social/settings">
                                    <Bell className="h-4 w-4 mr-2" />
                                    通知設定
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
