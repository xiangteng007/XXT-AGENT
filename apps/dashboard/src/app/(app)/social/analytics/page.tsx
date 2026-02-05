'use client';

import { useMemo } from 'react';
import { useSocialPosts } from '@/lib/hooks/useSocialData';
import { calculateSentimentSummary } from '@/lib/social/sentiment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/shared';
import chartStyles from '@/styles/charts.module.css';
import type { SocialPlatform } from '@/lib/social/types';
import {
    Activity,
    Smile,
    Frown,
    Meh,
    TrendingUp,
    TrendingDown,
    BarChart3,
    PieChart,
    Clock,
    MessageSquare,
} from 'lucide-react';

export default function SocialAnalyticsPage() {
    const { posts, isLoading } = useSocialPosts();

    const sentimentSummary = useMemo(() => calculateSentimentSummary(posts), [posts]);

    const platformStats = useMemo(() => {
        const stats: Record<string, { count: number; engagement: number }> = {};
        posts.forEach(post => {
            if (!stats[post.platform]) {
                stats[post.platform] = { count: 0, engagement: 0 };
            }
            stats[post.platform].count++;
            stats[post.platform].engagement += post.engagement.total;
        });
        return Object.entries(stats).sort((a, b) => b[1].count - a[1].count);
    }, [posts]);

    const hourlyDistribution = useMemo(() => {
        const hours = Array(24).fill(0);
        posts.forEach(post => {
            const hour = new Date(post.publishedAt).getHours();
            hours[hour]++;
        });
        return hours;
    }, [posts]);

    const topHashtags = useMemo(() => {
        const tagCounts: Record<string, number> = {};
        posts.forEach(post => {
            post.hashtags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });
        return Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }, [posts]);

    const topAuthors = useMemo(() => {
        const authorStats: Record<string, { name: string; posts: number; engagement: number }> = {};
        posts.forEach(post => {
            const key = post.author.username;
            if (!authorStats[key]) {
                authorStats[key] = { name: post.author.displayName, posts: 0, engagement: 0 };
            }
            authorStats[key].posts++;
            authorStats[key].engagement += post.engagement.total;
        });
        return Object.entries(authorStats)
            .sort((a, b) => b[1].engagement - a[1].engagement)
            .slice(0, 10);
    }, [posts]);

    const maxHourly = Math.max(...hourlyDistribution, 1);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">分析報表</h1>
                    <p className="text-muted-foreground">社群數據視覺化分析</p>
                </div>
                <LoadingSkeleton type="card" count={4} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BarChart3 className="h-6 w-6" />
                    分析報表
                </h1>
                <p className="text-muted-foreground">
                    共分析 {posts.length} 則貼文
                </p>
            </div>

            {/* Sentiment Overview */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">總貼文數</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{posts.length}</div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                        <Smile className="h-4 w-4 text-green-600" />
                        <CardTitle className="text-sm">正面情緒</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">
                            {sentimentSummary.distribution.positive}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                        <Meh className="h-4 w-4 text-gray-600" />
                        <CardTitle className="text-sm">中性情緒</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-600">
                            {sentimentSummary.distribution.neutral}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                        <Frown className="h-4 w-4 text-red-600" />
                        <CardTitle className="text-sm">負面情緒</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">
                            {sentimentSummary.distribution.negative}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Platform Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChart className="h-5 w-5" />
                            平台分布
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {platformStats.map(([platform, stats]) => {
                                const pct = (stats.count / posts.length) * 100;
                                return (
                                    <div key={platform} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="capitalize font-medium">{platform}</span>
                                            <span className="text-muted-foreground">
                                                {stats.count} 則 ({pct.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={`${chartStyles.progressBar} bg-primary`}
                                                style={{ '--progress-width': `${pct}%` } as React.CSSProperties}
                                                data-width={pct}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Hourly Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            發文時間分布
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-1 h-32">
                            {hourlyDistribution.map((count, hour) => (
                                <div
                                    key={hour}
                                    className={`flex-1 ${chartStyles.barChartItem} bg-primary/80 hover:bg-primary rounded-t`}
                                    style={{ '--bar-height': `${(count / maxHourly) * 100}%` } as React.CSSProperties}
                                    data-count={count}
                                    title={`${hour}:00 - ${count} 則`}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                            <span>0:00</span>
                            <span>6:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                            <span>24:00</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Top Hashtags */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            熱門 Hashtags
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {topHashtags.map(([tag, count], idx) => (
                                <div key={tag} className="flex items-center gap-3">
                                    <span className="w-6 text-center text-muted-foreground font-bold">
                                        {idx + 1}
                                    </span>
                                    <Badge variant="secondary">#{tag}</Badge>
                                    <span className="text-sm text-muted-foreground ml-auto">
                                        {count} 次
                                    </span>
                                </div>
                            ))}
                            {topHashtags.length === 0 && (
                                <p className="text-muted-foreground text-center py-4">
                                    無 hashtag 資料
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Top Authors */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            熱門作者
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {topAuthors.map(([username, stats], idx) => (
                                <div key={username} className="flex items-center gap-3">
                                    <span className="w-6 text-center text-muted-foreground font-bold">
                                        {idx + 1}
                                    </span>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{stats.name}</div>
                                        <div className="text-xs text-muted-foreground">@{username}</div>
                                    </div>
                                    <div className="text-right text-sm">
                                        <div>{stats.posts} 則</div>
                                        <div className="text-xs text-muted-foreground">
                                            {stats.engagement.toLocaleString()} 互動
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
