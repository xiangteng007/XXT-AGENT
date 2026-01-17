'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useMarketDashboard, useWatchlist, useMarketSignals } from '@/lib/hooks/useMarketData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton, SeverityBadge } from '@/components/shared';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    Minus,
    Activity,
    Grid3X3,
    List,
    Zap,
    Bell,
    ArrowRight,
    Clock,
    Star,
} from 'lucide-react';

const assetTypeLabels: Record<string, string> = {
    stock: '股票',
    etf: 'ETF',
    crypto: '加密貨幣',
    future: '期貨',
    forex: '外匯',
    bond: '債券',
    commodity: '大宗商品',
};

const signalStrengthColors: Record<string, string> = {
    strong: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    weak: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
};

export default function MarketDashboardPage() {
    const { summary, isLoading } = useMarketDashboard();
    const { items: watchlist } = useWatchlist();
    const { signals } = useMarketSignals();

    const activeSignals = useMemo(() => {
        return signals.filter(s => !s.isDismissed).slice(0, 5);
    }, [signals]);

    const formatPrice = (price: number) => {
        if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
        if (price >= 100) return price.toFixed(2);
        return price.toFixed(4);
    };

    const formatChange = (change: number, pct: number) => {
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)} (${sign}${pct.toFixed(2)}%)`;
    };

    const marketStatusLabel = (status?: string) => {
        switch (status) {
            case 'open': return { label: '開盤中', color: 'text-green-500' };
            case 'pre_market': return { label: '盤前', color: 'text-yellow-500' };
            case 'after_hours': return { label: '盤後', color: 'text-orange-500' };
            default: return { label: '休市', color: 'text-gray-500' };
        }
    };

    const status = marketStatusLabel(summary?.marketStatus);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">市場監控</h1>
                    <p className="text-muted-foreground">關注標的追蹤與異動偵測</p>
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
                        <BarChart3 className="h-6 w-6" />
                        市場監控
                    </h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <span>關注標的追蹤與異動偵測</span>
                        <Badge variant="outline" className={status.color}>
                            {status.label}
                        </Badge>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/market/watchlist">
                            <Star className="h-4 w-4 mr-2" />
                            自選清單
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/market/heatmap">
                            <Grid3X3 className="h-4 w-4 mr-2" />
                            熱力圖
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Indices */}
            {summary?.indices && summary.indices.length > 0 && (
                <div className="grid gap-3 md:grid-cols-4">
                    {summary.indices.slice(0, 4).map((idx) => (
                        <Card key={idx.name}>
                            <CardContent className="pt-4">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{idx.name}</span>
                                    {idx.change >= 0 ? (
                                        <TrendingUp className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <TrendingDown className="h-4 w-4 text-red-500" />
                                    )}
                                </div>
                                <div className="text-xl font-bold mt-1">{formatPrice(idx.value)}</div>
                                <div className={`text-sm ${idx.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {formatChange(idx.change, idx.changePct)}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">自選標的</CardTitle>
                        <Star className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                            {watchlist.length || summary?.watchlistCount || 0}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">今日訊號</CardTitle>
                        <Zap className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                            {signals.length || summary?.signalsToday || 0}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">活躍警報</CardTitle>
                        <Bell className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                            {summary?.alertsCount || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Top Movers */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Gainers */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-green-500" />
                                漲幅榜
                            </CardTitle>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/market/quotes">更多 <ArrowRight className="h-4 w-4 ml-1" /></Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(summary?.gainers || []).slice(0, 5).map((q) => (
                                    <div key={q.symbol} className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-950/50">
                                        <div className="flex items-center gap-3">
                                            <span className="font-medium">{q.symbol}</span>
                                            <span className="text-sm text-muted-foreground">{q.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium">{formatPrice(q.lastPrice)}</div>
                                            <div className="text-sm text-green-600">+{q.changePct.toFixed(2)}%</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Losers */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="flex items-center gap-2">
                                <TrendingDown className="h-5 w-5 text-red-500" />
                                跌幅榜
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(summary?.losers || []).slice(0, 5).map((q) => (
                                    <div key={q.symbol} className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-950/50">
                                        <div className="flex items-center gap-3">
                                            <span className="font-medium">{q.symbol}</span>
                                            <span className="text-sm text-muted-foreground">{q.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium">{formatPrice(q.lastPrice)}</div>
                                            <div className="text-sm text-red-600">{q.changePct.toFixed(2)}%</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Active Signals */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Zap className="h-5 w-5 text-amber-500" />
                                最新訊號
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {activeSignals.map((signal) => (
                                    <div key={signal.id} className="p-2 rounded bg-muted/50">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="secondary">{signal.symbol}</Badge>
                                            <Badge className={signalStrengthColors[signal.strength]}>
                                                {signal.strength}
                                            </Badge>
                                            {signal.direction === 'bullish' ? (
                                                <TrendingUp className="h-4 w-4 text-green-500" />
                                            ) : signal.direction === 'bearish' ? (
                                                <TrendingDown className="h-4 w-4 text-red-500" />
                                            ) : (
                                                <Minus className="h-4 w-4 text-gray-400" />
                                            )}
                                        </div>
                                        <p className="text-sm line-clamp-1">{signal.title}</p>
                                    </div>
                                ))}
                                {activeSignals.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        暫無訊號
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sector Performance */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">產業表現</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(summary?.sectorPerformance || []).slice(0, 6).map((s) => (
                                    <div key={s.sector} className="flex items-center justify-between">
                                        <span className="text-sm">{s.sector}</span>
                                        <span className={`text-sm font-medium ${s.changePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                                        </span>
                                    </div>
                                ))}
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
                                <Link href="/market/quotes">
                                    <Activity className="h-4 w-4 mr-2" />
                                    即時報價
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start" asChild>
                                <Link href="/market/signals">
                                    <Zap className="h-4 w-4 mr-2" />
                                    訊號雷達
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
