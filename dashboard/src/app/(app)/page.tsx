'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFusedEvents, getSystemMetrics } from '@/lib/api/client';
import type { FusedEvent, SystemMetrics } from '@/lib/api/types';
import { MetricCard, SeverityBadge, LoadingSkeleton } from '@/components/shared';
import { formatTime } from '@/lib/utils';
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
    ArrowRight,
    Sparkles,
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
                setEvents(eventsData.slice(0, 10));
                setMetrics(metricsData);
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

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

    const getDomainIcon = (domain: string) => {
        switch (domain) {
            case 'market': return <TrendingUp className="h-4 w-4" />;
            case 'news': return <Newspaper className="h-4 w-4" />;
            case 'social': return <MessageSquare className="h-4 w-4" />;
            default: return <Zap className="h-4 w-4" />;
        }
    };

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="space-y-2">
                    <div className="h-10 w-48 bg-muted/50 rounded-lg animate-pulse" />
                    <div className="h-5 w-64 bg-muted/30 rounded animate-pulse" />
                </div>
                <LoadingSkeleton type="card" count={4} />
                <LoadingSkeleton type="table" count={5} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Premium Header */}
            <header className="relative">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20">
                        <Sparkles className="h-6 w-6 text-gold" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            總覽
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            AI ME 智能監控平台
                        </p>
                    </div>
                </div>
            </header>

            {/* Metrics Grid - International Layout */}
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    title="每分鐘處理"
                    value={metrics?.pipeline.ingestPerMin ?? 0}
                    subtitle="events/min"
                    icon={<Activity className="h-5 w-5" />}
                    trend="up"
                    trendValue="+12%"
                />
                <MetricCard
                    title="融合事件"
                    value={metrics?.pipeline.fusedPerMin ?? 0}
                    subtitle="fused/min"
                    icon={<Zap className="h-5 w-5" />}
                />
                <MetricCard
                    title="通知成功率"
                    value={`${((metrics?.pipeline.notifySuccessRate ?? 0) * 100).toFixed(1)}%`}
                    subtitle={`今日已發送 ${metrics?.alerts.sentToday ?? 0} 則`}
                    icon={<Bell className="h-5 w-5" />}
                    trend="up"
                    trendValue="98.7%"
                />
                <MetricCard
                    title="DLQ 待處理"
                    value={metrics?.pipeline.dlqCount ?? 0}
                    subtitle="dead letter queue"
                    icon={<AlertTriangle className="h-5 w-5" />}
                    trend={metrics?.pipeline.dlqCount && metrics.pipeline.dlqCount > 0 ? 'down' : 'neutral'}
                />
            </section>

            {/* Two Column Premium Layout */}
            <section className="grid gap-6 lg:grid-cols-5">
                {/* Severity Distribution - Compact */}
                <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-gold/10">
                                <BarChart3 className="h-4 w-4 text-gold" />
                            </div>
                            嚴重程度分佈
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-3">
                            <div className="text-center p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                                <div className="text-2xl font-bold text-red-400 tabular-nums">
                                    {severityDistribution.critical}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1 font-medium">危急</div>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                <div className="text-2xl font-bold text-amber-400 tabular-nums">
                                    {severityDistribution.high}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1 font-medium">高</div>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-gold/5 border border-gold/10">
                                <div className="text-2xl font-bold text-gold tabular-nums">
                                    {severityDistribution.medium}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1 font-medium">中</div>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                <div className="text-2xl font-bold text-emerald-400 tabular-nums">
                                    {severityDistribution.low}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1 font-medium">低</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Service Status - Enhanced */}
                <Card className="lg:col-span-3 border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-gold/10">
                                <Radio className="h-4 w-4 text-gold" />
                            </div>
                            服務狀態
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {metrics?.services &&
                                Object.entries(metrics.services).map(([name, service]) => (
                                    <div 
                                        key={name} 
                                        className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50"
                                    >
                                        <span className="text-sm text-muted-foreground font-medium">
                                            {name.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                        <Badge
                                            variant={service.status === 'healthy' ? 'default' : 'destructive'}
                                            className={
                                                service.status === 'healthy'
                                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                                    : 'bg-red-500/15 text-red-400 border border-red-500/20'
                                            }
                                        >
                                            {service.status === 'healthy' ? '正常' : '異常'}
                                        </Badge>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Events Timeline - Premium Design */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-semibold">最新事件</CardTitle>
                    <Link
                        href="/events"
                        className="text-sm font-medium text-gold hover:text-gold/80 transition-colors flex items-center gap-1.5 group"
                    >
                        查看全部
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-border/50">
                        {events.length === 0 ? (
                            <p className="text-center text-muted-foreground py-12">暫無事件</p>
                        ) : (
                            events.map((event, index) => (
                                <div
                                    key={event.id}
                                    className="flex items-start gap-4 p-4 hover:bg-gold/[0.02] transition-colors cursor-pointer group"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="flex-shrink-0 mt-0.5 p-2.5 rounded-xl bg-muted/50 border border-border/50 group-hover:border-gold/20 transition-colors">
                                        {getDomainIcon(event.domain)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                            <SeverityBadge severity={event.severity} size="sm" />
                                            {event.symbol && (
                                                <Badge variant="outline" className="text-xs font-semibold border-gold/30 text-gold">
                                                    {event.symbol}
                                                </Badge>
                                            )}
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {formatTime(event.ts)}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium line-clamp-1 group-hover:text-gold/90 transition-colors">
                                            {event.news_title}
                                        </p>
                                        {event.impact_summary && (
                                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
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
