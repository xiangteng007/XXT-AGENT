'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFusedEvents, getSystemMetrics } from '@/lib/api/client';
import type { FusedEvent, SystemMetrics } from '@/lib/api/types';
import { MetricCard, SeverityBadge, LoadingSkeleton } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Activity,
    Zap,
    Bell,
    AlertTriangle,
    TrendingUp,
    Radio,
    Newspaper,
    MessageSquare,
    BarChart3,
} from 'lucide-react';

export default function OverviewPage() {
    const [events, setEvents] = useState<FusedEvent[]>([]);
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const [eventsData, metricsData] = await Promise.all([
                    getFusedEvents(),
                    getSystemMetrics(),
                ]);
                setEvents(eventsData.slice(0, 15)); // Top 15 events
                setMetrics(metricsData);
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Calculate severity distribution
    const severityDistribution = events.reduce(
        (acc, event) => {
            if (event.severity >= 80) acc.critical++;
            else if (event.severity >= 60) acc.high++;
            else if (event.severity >= 40) acc.medium++;
            else acc.low++;
            return acc;
        },
        { critical: 0, high: 0, medium: 0, low: 0 }
    );

    const formatTime = (ts: string) => {
        const date = new Date(ts);
        return date.toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getDomainIcon = (domain: string) => {
        switch (domain) {
            case 'market':
                return <TrendingUp className="h-4 w-4" />;
            case 'news':
                return <Newspaper className="h-4 w-4" />;
            case 'social':
                return <MessageSquare className="h-4 w-4" />;
            default:
                return <Zap className="h-4 w-4" />;
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">總覽</h1>
                    <p className="text-muted-foreground">AI ME 智能監控平台</p>
                </div>
                <LoadingSkeleton type="card" count={4} />
                <LoadingSkeleton type="table" count={5} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">總覽</h1>
                <p className="text-muted-foreground">AI ME 智能監控平台</p>
            </div>

            {/* System Health Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="每分鐘處理"
                    value={metrics?.pipeline.ingestPerMin ?? 0}
                    subtitle="events/min"
                    icon={<Activity className="h-4 w-4" />}
                    trend="up"
                    trendValue="+12%"
                />
                <MetricCard
                    title="融合事件"
                    value={metrics?.pipeline.fusedPerMin ?? 0}
                    subtitle="fused/min"
                    icon={<Zap className="h-4 w-4" />}
                />
                <MetricCard
                    title="通知成功率"
                    value={`${((metrics?.pipeline.notifySuccessRate ?? 0) * 100).toFixed(1)}%`}
                    subtitle="今日已發送 {metrics?.alerts.sentToday ?? 0} 則"
                    icon={<Bell className="h-4 w-4" />}
                    trend="up"
                    trendValue="98.7%"
                />
                <MetricCard
                    title="DLQ 待處理"
                    value={metrics?.pipeline.dlqCount ?? 0}
                    subtitle="dead letter queue"
                    icon={<AlertTriangle className="h-4 w-4" />}
                    trend={metrics?.pipeline.dlqCount && metrics.pipeline.dlqCount > 0 ? 'down' : 'neutral'}
                />
            </div>

            {/* Severity Distribution */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            嚴重程度分佈
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-red-500">
                                    {severityDistribution.critical}
                                </div>
                                <div className="text-xs text-muted-foreground">危急 (80+)</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-orange-500">
                                    {severityDistribution.high}
                                </div>
                                <div className="text-xs text-muted-foreground">高 (60-79)</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-500">
                                    {severityDistribution.medium}
                                </div>
                                <div className="text-xs text-muted-foreground">中 (40-59)</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-500">
                                    {severityDistribution.low}
                                </div>
                                <div className="text-xs text-muted-foreground">低 (&lt;40)</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Radio className="h-4 w-4" />
                            服務狀態
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-2">
                            {metrics?.services &&
                                Object.entries(metrics.services).map(([name, service]) => (
                                    <div key={name} className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground capitalize">
                                            {name.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                        <Badge
                                            variant={service.status === 'healthy' ? 'default' : 'destructive'}
                                            className={
                                                service.status === 'healthy'
                                                    ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                                                    : ''
                                            }
                                        >
                                            {service.status === 'healthy' ? '正常' : '異常'}
                                        </Badge>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Events Timeline */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">最新事件</CardTitle>
                    <Link
                        href="/events"
                        className="text-sm text-primary hover:underline"
                    >
                        查看全部 →
                    </Link>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {events.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">暫無事件</p>
                        ) : (
                            events.map((event) => (
                                <div
                                    key={event.id}
                                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                >
                                    <div className="flex-shrink-0 mt-0.5 p-2 rounded-full bg-muted">
                                        {getDomainIcon(event.domain)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <SeverityBadge severity={event.severity} size="sm" />
                                            {event.symbol && (
                                                <Badge variant="outline" className="text-xs">
                                                    {event.symbol}
                                                </Badge>
                                            )}
                                            <span className="text-xs text-muted-foreground">
                                                {formatTime(event.ts)}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium line-clamp-1">
                                            {event.news_title}
                                        </p>
                                        {event.impact_summary && (
                                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                                {event.impact_summary}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
