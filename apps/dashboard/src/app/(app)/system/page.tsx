'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Activity,
    RefreshCw,
    Server,
    Clock,
    Zap,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Gauge,
    Shield,
    Wifi,
    WifiOff,
} from 'lucide-react';

// ================================
// Types
// ================================

interface ServiceStatus {
    name: string;
    emoji: string;
    status: 'healthy' | 'unhealthy' | 'loading';
    latencyMs?: number;
    error?: string;
    checkedAt?: string;
}

interface Summary {
    total: number;
    healthy: number;
    unhealthy: number;
}

// ================================
// Latency color helper
// ================================
function latencyColor(ms: number): string {
    if (ms < 300) return 'text-emerald-400';
    if (ms < 500) return 'text-amber-400';
    return 'text-red-400';
}

function latencyLabel(ms: number): string {
    if (ms < 300) return '極速';
    if (ms < 500) return '正常';
    return '緩慢';
}

// ================================
// Component
// ================================

export default function SystemHealthPage() {
    const [services, setServices] = useState<ServiceStatus[]>([]);
    const [summary, setSummary] = useState<Summary>({ total: 12, healthy: 0, unhealthy: 0 });
    const [lastRefresh, setLastRefresh] = useState<string>('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshAll = useCallback(async () => {
        setIsRefreshing(true);
        setError(null);
        try {
            const res = await fetch('/api/system/check');
            if (res.ok) {
                const data = await res.json();
                const statuses: ServiceStatus[] = (data.services || []).map(
                    (s: { name: string; emoji: string; status: string; latencyMs: number; error?: string; checkedAt?: string }) => ({
                        name: s.name,
                        emoji: s.emoji || '🔧',
                        status: s.status as 'healthy' | 'unhealthy',
                        latencyMs: s.latencyMs,
                        error: s.error,
                        checkedAt: s.checkedAt
                            ? new Date(s.checkedAt).toLocaleTimeString('zh-TW')
                            : undefined,
                    })
                );
                setServices(statuses);
                setSummary(data.summary || { total: statuses.length, healthy: statuses.filter((s: ServiceStatus) => s.status === 'healthy').length, unhealthy: statuses.filter((s: ServiceStatus) => s.status === 'unhealthy').length });
            } else {
                setError(`API 回應異常: HTTP ${res.status}`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '網路錯誤');
        }
        setLastRefresh(new Date().toLocaleTimeString('zh-TW'));
        setIsRefreshing(false);
    }, []);

    // Initial load + auto-refresh every 30s
    useEffect(() => {
        refreshAll();
        if (!autoRefresh) return;
        const interval = setInterval(refreshAll, 30000);
        return () => clearInterval(interval);
    }, [refreshAll, autoRefresh]);

    // Aggregate stats
    const avgLatency = Math.round(
        services.filter(s => s.latencyMs).reduce((sum, s) => sum + (s.latencyMs || 0), 0) /
        Math.max(1, services.filter(s => s.latencyMs).length)
    );
    const maxLatency = Math.max(...services.filter(s => s.latencyMs).map(s => s.latencyMs || 0), 0);
    const minLatency = services.filter(s => s.latencyMs).length > 0
        ? Math.min(...services.filter(s => s.latencyMs).map(s => s.latencyMs || 0))
        : 0;

    const overallHealthy = summary.unhealthy === 0 && services.length > 0;
    const uptimePercent = services.length > 0 ? Math.round((summary.healthy / summary.total) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/20">
                        <Server className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">運維中心 — 基礎設施</h1>
                        <p className="text-muted-foreground">
                            Cloud Run 微服務即時狀態 • 最後更新：{lastRefresh || '—'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={e => setAutoRefresh(e.target.checked)}
                            className="rounded"
                        />
                        自動刷新 (30s)
                    </label>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshAll}
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? '檢查中...' : '立即刷新'}
                    </Button>
                </div>
            </div>

            {/* Overall Status Banner */}
            <Card className={`border-${overallHealthy ? 'emerald' : 'red'}-500/30 bg-gradient-to-r ${overallHealthy ? 'from-emerald-500/5' : 'from-red-500/5'} to-transparent`}>
                <CardContent className="pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${overallHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                        <span className="font-medium">
                            {overallHealthy ? '全部服務正常運行' : `${summary.unhealthy} 個服務需要關注`}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                            {summary.healthy}/{summary.total} 在線
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Shield className="h-3.5 w-3.5" />
                            IAM 保護
                        </span>
                        <span className="flex items-center gap-1">
                            <Wifi className="h-3.5 w-3.5" />
                            GCP Cloud Run
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Error Alert */}
            {error && (
                <Card className="border-red-500/30 bg-red-500/5">
                    <CardContent className="pt-4 flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
                        <span className="text-sm text-red-300">{error}</span>
                    </CardContent>
                </Card>
            )}

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="card-lift">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">可用性</CardTitle>
                        <Activity className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{uptimePercent}%</div>
                        <div className="flex items-center gap-1 mt-1">
                            {overallHealthy ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                            )}
                            <span className="text-xs text-muted-foreground">
                                {summary.healthy} 個服務在線
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="card-lift">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">平均延遲</CardTitle>
                        <Gauge className="h-4 w-4 text-amber-400" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${latencyColor(avgLatency)}`}>{avgLatency}ms</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            最快 {minLatency}ms · 最慢 {maxLatency}ms
                        </p>
                    </CardContent>
                </Card>

                <Card className="card-lift">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">異常服務</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${summary.unhealthy > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {summary.unhealthy}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {summary.unhealthy === 0 ? '✅ 零異常' : '⚠️ 需要處理'}
                        </p>
                    </CardContent>
                </Card>

                <Card className="card-lift">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">服務總數</CardTitle>
                        <Server className="h-4 w-4 text-cyan-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{summary.total}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Cloud Run 微服務
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Service Status Grid */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            微服務狀態
                        </CardTitle>
                        <Badge variant="outline">{services.length} 個服務</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {services.length === 0 && !isRefreshing && (
                            <p className="text-sm text-muted-foreground col-span-full text-center py-8">
                                尚未載入任何服務狀態
                            </p>
                        )}
                        {services.length === 0 && isRefreshing && (
                            Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="rounded-lg border bg-muted/30 p-4 animate-pulse">
                                    <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                                    <div className="h-3 bg-muted rounded w-1/2 mb-2" />
                                    <div className="h-3 bg-muted rounded w-1/3" />
                                </div>
                            ))
                        )}
                        {services.map(svc => (
                            <div
                                key={svc.name}
                                className={`group relative rounded-lg border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                                    svc.status === 'healthy'
                                        ? 'border-emerald-500/20 bg-emerald-500/[0.03] hover:border-emerald-500/40'
                                        : svc.status === 'unhealthy'
                                        ? 'border-red-500/20 bg-red-500/[0.03] hover:border-red-500/40'
                                        : 'border-border bg-muted/30'
                                }`}
                            >
                                {/* Status indicator line */}
                                <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${
                                    svc.status === 'healthy' ? 'bg-emerald-400' :
                                    svc.status === 'unhealthy' ? 'bg-red-400' : 'bg-muted-foreground'
                                }`} />

                                <div className="pl-3">
                                    {/* Service Name + Status */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-lg flex-shrink-0">{svc.emoji}</span>
                                            <span className="font-medium text-sm truncate">{svc.name}</span>
                                        </div>
                                        {svc.status === 'healthy' ? (
                                            <Wifi className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                                        ) : svc.status === 'unhealthy' ? (
                                            <WifiOff className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                                        ) : (
                                            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin flex-shrink-0" />
                                        )}
                                    </div>

                                    {/* Metrics */}
                                    {svc.status === 'loading' ? (
                                        <div className="text-xs text-muted-foreground">檢查中...</div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <Zap className={`h-3 w-3 ${latencyColor(svc.latencyMs || 0)}`} />
                                                    <span className={`text-xs font-mono ${latencyColor(svc.latencyMs || 0)}`}>
                                                        {svc.latencyMs}ms
                                                    </span>
                                                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                                        {latencyLabel(svc.latencyMs || 0)}
                                                    </Badge>
                                                </div>
                                            </div>
                                            {svc.error && (
                                                <div className="flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
                                                    <span className="text-[11px] text-red-400 truncate">{svc.error}</span>
                                                </div>
                                            )}
                                            {svc.checkedAt && (
                                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {svc.checkedAt}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Latency Distribution Bar */}
            {services.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Gauge className="h-4 w-4" />
                            延遲分佈
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {services
                                .filter(s => s.status !== 'loading')
                                .sort((a, b) => (a.latencyMs || 0) - (b.latencyMs || 0))
                                .map(svc => {
                                    const pct = maxLatency > 0 ? Math.max(5, ((svc.latencyMs || 0) / maxLatency) * 100) : 5;
                                    return (
                                        <div key={svc.name} className="flex items-center gap-3">
                                            <span className="text-xs w-36 truncate text-muted-foreground">{svc.emoji} {svc.name}</span>
                                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                                {/* eslint-disable-next-line react/forbid-dom-props */}
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${
                                                        (svc.latencyMs || 0) < 300
                                                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                                            : (svc.latencyMs || 0) < 500
                                                            ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                                                            : 'bg-gradient-to-r from-red-500 to-red-400'
                                                    }`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-mono w-14 text-right ${latencyColor(svc.latencyMs || 0)}`}>
                                                {svc.latencyMs}ms
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
