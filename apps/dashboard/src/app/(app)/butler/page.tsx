'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Heart,
    Car,
    Wallet,
    Calendar,
    MessageSquare,
    Activity,
    Fuel,
    TrendingUp,
    Bell,
    ArrowRight,
    Sparkles,
    Settings,
} from 'lucide-react';

// Mock data for overview
const healthSummary = {
    bmi: 28.3,
    bmiStatus: '過重',
    todayCalories: 1850,
    targetCalories: 2200,
    lastExercise: '2 天前',
    weight: 81.8,
};

const vehicleSummary = {
    name: 'Jimny JB74',
    lastRefuel: '2026-01-28',
    nextMaintenance: '2026-03-15',
    totalKm: 15680,
    avgFuelConsumption: 8.2,
};

const financeSummary = {
    totalBalance: 152800,
    monthlyExpense: 45200,
    pendingBills: 2,
    nextBillDue: '2026-02-10',
};

const calendarSummary = {
    todayEvents: 3,
    upcomingEvents: 8,
    nextEvent: '團隊會議 - 14:00',
};

export default function ButlerDashboardPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20">
                        <Sparkles className="h-6 w-6 text-gold" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">個人管家</h1>
                        <p className="text-muted-foreground">您的智能生活助理</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/butler/admin">
                            <Settings className="h-4 w-4 mr-2" />
                            管理面板
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/butler/chat">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            AI 對話
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-stagger">
                {/* Health Card */}
                <Card className="bg-card border-emerald-500/30 relative overflow-hidden card-glow card-lift cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">健康狀態</CardTitle>
                        <div className="p-2 rounded-lg bg-emerald-500/20">
                            <Heart className="h-4 w-4 text-emerald-400" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold text-foreground tracking-tight">
                            BMI {healthSummary.bmi}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                                {healthSummary.bmiStatus}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                {healthSummary.weight} kg
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Vehicle Card */}
                <Card className="bg-card border-blue-500/30 relative overflow-hidden card-glow card-lift cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">車輛狀態</CardTitle>
                        <div className="p-2 rounded-lg bg-blue-500/20">
                            <Car className="h-4 w-4 text-blue-400" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold text-foreground tracking-tight">
                            {vehicleSummary.totalKm.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-blue-400">公里</span>
                            <span className="text-xs text-muted-foreground">
                                · 油耗 {vehicleSummary.avgFuelConsumption} L/100km
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Finance Card */}
                <Card className="bg-card border-gold/30 relative overflow-hidden card-glow card-lift cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">財務總覽</CardTitle>
                        <div className="p-2 rounded-lg bg-gold/20">
                            <Wallet className="h-4 w-4 text-gold" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold text-foreground tracking-tight">
                            ${financeSummary.totalBalance.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gold">
                                本月支出 ${financeSummary.monthlyExpense.toLocaleString()}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Calendar Card */}
                <Card className="bg-card border-purple-500/30 relative overflow-hidden card-glow card-lift cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">今日行程</CardTitle>
                        <div className="p-2 rounded-lg bg-purple-500/20">
                            <Calendar className="h-4 w-4 text-purple-400" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold text-foreground tracking-tight">
                            {calendarSummary.todayEvents}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-purple-400">個事件</span>
                            <span className="text-xs text-muted-foreground">
                                · 下一個: {calendarSummary.nextEvent}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Module Links */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/butler/health">
                    <Card className="group hover:border-emerald-500/50 transition-all cursor-pointer card-lift">
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Activity className="h-5 w-5 text-emerald-400" />
                                <span className="font-medium">健康追蹤</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/butler/vehicle">
                    <Card className="group hover:border-blue-500/50 transition-all cursor-pointer card-lift">
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Fuel className="h-5 w-5 text-blue-400" />
                                <span className="font-medium">車輛管理</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/butler/finance">
                    <Card className="group hover:border-gold/50 transition-all cursor-pointer card-lift">
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="h-5 w-5 text-gold" />
                                <span className="font-medium">財務管理</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors" />
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/butler/calendar">
                    <Card className="group hover:border-purple-500/50 transition-all cursor-pointer card-lift">
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Bell className="h-5 w-5 text-purple-400" />
                                <span className="font-medium">行事曆</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-400 transition-colors" />
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Upcoming Reminders */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-gold" />
                        即將到來的提醒
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/20">
                                    <Car className="h-4 w-4 text-blue-400" />
                                </div>
                                <div>
                                    <p className="font-medium">車輛保養</p>
                                    <p className="text-sm text-muted-foreground">Jimny JB74 定期保養</p>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                                38 天後
                            </Badge>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gold/20">
                                    <Wallet className="h-4 w-4 text-gold" />
                                </div>
                                <div>
                                    <p className="font-medium">信用卡帳單</p>
                                    <p className="text-sm text-muted-foreground">中信銀行 2月帳單</p>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-gold border-gold/30">
                                5 天後
                            </Badge>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-500/20">
                                    <Heart className="h-4 w-4 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="font-medium">健康檢查</p>
                                    <p className="text-sm text-muted-foreground">年度健檢預約</p>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                                14 天後
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
