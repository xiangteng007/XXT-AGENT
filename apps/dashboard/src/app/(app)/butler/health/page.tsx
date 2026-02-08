'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Heart,
    Footprints,
    Moon,
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Loader2,
    Flame,
    Activity,
    Scale,
} from 'lucide-react';

interface HealthData {
    today: {
        steps: number;
        stepsGoal: number;
        activeMinutes: number;
        calories: number;
        sleepHours: number;
    } | null;
    trend: Array<{ date: string; steps: number; calories: number; sleepHours: number; activeMinutes: number }>;
    weights: Array<{ date: string; weight: number }>;
}

export default function HealthPage() {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/butler/health')
            .then(r => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
        );
    }

    const today = data?.today;
    const stepsPercentage = today ? Math.min((today.steps / today.stepsGoal) * 100, 100) : 0;
    const latestWeight = data?.weights?.[0]?.weight;
    const weightChange = data?.weights && data.weights.length >= 2
        ? Math.round((data.weights[0].weight - data.weights[data.weights.length - 1].weight) * 10) / 10
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/butler">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20">
                    <Heart className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">健康管理</h1>
                    <p className="text-muted-foreground">每日健康追蹤</p>
                </div>
            </div>

            {/* Today Stats */}
            <div className="grid gap-4 md:grid-cols-4 animate-stagger">
                <Card className="bg-card border-emerald-500/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">步數</CardTitle>
                        <Footprints className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-emerald-400">
                            {(today?.steps ?? 0).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stepsPercentage}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{today?.stepsGoal?.toLocaleString()}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-orange-500/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">卡路里</CardTitle>
                        <Flame className="h-4 w-4 text-orange-400" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-orange-400">
                            {today?.calories ?? 0}
                        </div>
                        <span className="text-xs text-muted-foreground">kcal 消耗</span>
                    </CardContent>
                </Card>

                <Card className="bg-card border-indigo-500/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">睡眠</CardTitle>
                        <Moon className="h-4 w-4 text-indigo-400" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-indigo-400">
                            {today?.sleepHours ?? 0}h
                        </div>
                        <span className="text-xs text-muted-foreground">目標 7-8h</span>
                    </CardContent>
                </Card>

                <Card className="bg-card border-blue-500/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">運動</CardTitle>
                        <Activity className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-3xl font-bold text-blue-400">
                            {today?.activeMinutes ?? 0}
                        </div>
                        <span className="text-xs text-muted-foreground">分鐘</span>
                    </CardContent>
                </Card>
            </div>

            {/* Weight */}
            {data?.weights && data.weights.length > 0 && (
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Scale className="h-5 w-5 text-gold" />
                            體重趨勢
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="text-4xl font-bold">{latestWeight} kg</div>
                            {weightChange !== 0 && (
                                <div className={`flex items-center gap-1 text-sm ${weightChange < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {weightChange < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                                    {weightChange > 0 ? '+' : ''}{weightChange} kg
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            {data.weights.map((w, i) => (
                                <div key={i} className="flex justify-between p-2 rounded bg-muted/50 text-sm">
                                    <span className="text-muted-foreground">{w.date}</span>
                                    <span className="font-medium">{w.weight} kg</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 7-day Trend */}
            {data?.trend && data.trend.length > 0 && (
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-400" />
                            7 日趨勢
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {data.trend.map((day, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                    <span className="text-sm text-muted-foreground w-24">{day.date}</span>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="flex items-center gap-1">
                                            <Footprints className="h-3 w-3 text-emerald-400" />
                                            {day.steps.toLocaleString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Flame className="h-3 w-3 text-orange-400" />
                                            {day.calories}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Moon className="h-3 w-3 text-indigo-400" />
                                            {day.sleepHours}h
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty state */}
            {!today && (!data?.trend || data.trend.length === 0) && (
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardContent className="py-12 text-center">
                        <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">尚無健康數據</h3>
                        <p className="text-muted-foreground">透過 LINE 傳送「體重 80.5」或「步數 8500」開始追蹤</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
