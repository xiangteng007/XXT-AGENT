'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Heart,
    Activity,
    Scale,
    Flame,
    TrendingUp,
    TrendingDown,
    Target,
    Plus,
    ArrowLeft,
    Calendar,
} from 'lucide-react';

// Mock health data
const healthData = {
    profile: {
        height: 170,
        weight: 81.8,
        age: 35,
        gender: 'male',
    },
    bmi: 28.3,
    bmr: 1782,
    tdee: 2450,
    targetWeight: 75,
    weightHistory: [
        { date: '2026-01-01', weight: 83.5 },
        { date: '2026-01-15', weight: 82.8 },
        { date: '2026-02-01', weight: 81.8 },
    ],
    exerciseLog: [
        { date: '2026-02-03', type: '快走', duration: 30, calories: 180 },
        { date: '2026-02-01', type: '騎車', duration: 45, calories: 320 },
        { date: '2026-01-30', type: '重訓', duration: 60, calories: 280 },
    ],
    todayStats: {
        calories: 1850,
        target: 2200,
        steps: 6500,
        water: 1.5,
    },
};

export default function HealthPage() {
    const [showAddExercise, setShowAddExercise] = useState(false);

    const getBmiCategory = (bmi: number) => {
        if (bmi < 18.5) return { label: '過輕', color: 'text-blue-400' };
        if (bmi < 24) return { label: '正常', color: 'text-emerald-400' };
        if (bmi < 27) return { label: '過重', color: 'text-yellow-400' };
        return { label: '肥胖', color: 'text-red-400' };
    };

    const bmiCategory = getBmiCategory(healthData.bmi);
    const calorieProgress = (healthData.todayStats.calories / healthData.todayStats.target) * 100;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
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
                        <h1 className="text-2xl font-bold">健康追蹤</h1>
                        <p className="text-muted-foreground">監測您的健康指標與運動記錄</p>
                    </div>
                </div>
                <Button onClick={() => setShowAddExercise(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    記錄運動
                </Button>
            </div>

            {/* Body Metrics */}
            <div className="grid gap-4 md:grid-cols-4 animate-stagger">
                <Card className="bg-card border-emerald-500/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">BMI</CardTitle>
                        <Scale className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold">{healthData.bmi}</div>
                        <Badge variant="outline" className={`${bmiCategory.color} border-current/30 mt-1`}>
                            {bmiCategory.label}
                        </Badge>
                    </CardContent>
                </Card>

                <Card className="bg-card border-blue-500/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">基礎代謝率</CardTitle>
                        <Flame className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold">{healthData.bmr}</div>
                        <span className="text-xs text-blue-400">kcal/天</span>
                    </CardContent>
                </Card>

                <Card className="bg-card border-gold/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">每日消耗</CardTitle>
                        <Activity className="h-4 w-4 text-gold" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold">{healthData.tdee}</div>
                        <span className="text-xs text-gold">kcal/天 (TDEE)</span>
                    </CardContent>
                </Card>

                <Card className="bg-card border-purple-500/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">目標體重</CardTitle>
                        <Target className="h-4 w-4 text-purple-400" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold">{healthData.targetWeight}</div>
                        <span className="text-xs text-purple-400">kg · 還需減 {(healthData.profile.weight - healthData.targetWeight).toFixed(1)} kg</span>
                    </CardContent>
                </Card>
            </div>

            {/* Today's Progress */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Flame className="h-5 w-5 text-gold" />
                        今日進度
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm">卡路里攝取</span>
                                <span className="text-sm font-medium">{healthData.todayStats.calories} / {healthData.todayStats.target} kcal</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-emerald-500 to-gold rounded-full transition-all"
                                    style={{ width: `${Math.min(calorieProgress, 100)}%` }}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg bg-muted/50">
                                <p className="text-sm text-muted-foreground">步數</p>
                                <p className="text-2xl font-bold">{healthData.todayStats.steps.toLocaleString()}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/50">
                                <p className="text-sm text-muted-foreground">飲水量</p>
                                <p className="text-2xl font-bold">{healthData.todayStats.water} L</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Weight Trend */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-emerald-400" />
                        體重趨勢
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {healthData.weightHistory.map((entry, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span>{entry.date}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{entry.weight} kg</span>
                                    {i > 0 && (
                                        <Badge variant="outline" className={
                                            entry.weight < healthData.weightHistory[i-1].weight 
                                                ? 'text-emerald-400 border-emerald-400/30' 
                                                : 'text-red-400 border-red-400/30'
                                        }>
                                            {entry.weight < healthData.weightHistory[i-1].weight ? '↓' : '↑'}
                                            {Math.abs(entry.weight - healthData.weightHistory[i-1].weight).toFixed(1)}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Exercise Log */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-400" />
                        運動記錄
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {healthData.exerciseLog.map((exercise, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/20">
                                        <Activity className="h-4 w-4 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{exercise.type}</p>
                                        <p className="text-sm text-muted-foreground">{exercise.date} · {exercise.duration} 分鐘</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-gold border-gold/30">
                                    -{exercise.calories} kcal
                                </Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
