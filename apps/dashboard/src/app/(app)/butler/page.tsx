'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
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
    Loader2,
} from 'lucide-react';

// ================================
// Types for API summaries
// ================================

interface HealthSummary {
    weight: number | null;
    bmi: number | null;
    bmiStatus: string;
    todayCalories: number;
    todaySteps: number;
}

interface VehicleSummary {
    name: string;
    totalKm: number;
    avgFuelConsumption: number;
    nextMaintenanceDate: string | null;
}

interface FinanceSummary {
    totalIncome: number;
    monthlyExpense: number;
    netSavings: number;
    transactionCount: number;
}

interface CalendarSummary {
    todayEvents: number;
    weekEvents: number;
    nextEvent: string | null;
    reminders: Array<{ id: string; title: string; dueDate: string }>;
}

// ================================
// BMI classification helper
// ================================
function bmiStatus(bmi: number): string {
    if (bmi < 18.5) return '過輕';
    if (bmi < 24) return '正常';
    if (bmi < 27) return '過重';
    return '肥胖';
}

function daysUntil(dateStr: string | null): string {
    if (!dateStr) return '—';
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    if (diff < 0) return '已過期';
    if (diff === 0) return '今天';
    return `${diff} 天後`;
}

export default function ButlerDashboardPage() {
    const { getIdToken } = useAuth();
    const [health, setHealth] = useState<HealthSummary | null>(null);
    const [vehicle, setVehicle] = useState<VehicleSummary | null>(null);
    const [finance, setFinance] = useState<FinanceSummary | null>(null);
    const [calendar, setCalendar] = useState<CalendarSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const token = await getIdToken();
            const headers = { Authorization: `Bearer ${token}` };

            const [healthRes, vehicleRes, financeRes, scheduleRes] = await Promise.all([
                fetch('/api/butler/health', { headers }).catch(() => null),
                fetch('/api/butler/vehicle', { headers }).catch(() => null),
                fetch('/api/butler/finance', { headers }).catch(() => null),
                fetch('/api/butler/schedule', { headers }).catch(() => null),
            ]);

            // --- Health ---
            if (healthRes?.ok) {
                const h = await healthRes.json();
                const latestWeight = h.weights?.[0]?.weight ?? null;
                const heightM = 1.70; // Can be made configurable later
                const calculatedBmi = latestWeight ? Math.round((latestWeight / (heightM * heightM)) * 10) / 10 : null;
                setHealth({
                    weight: latestWeight,
                    bmi: calculatedBmi,
                    bmiStatus: calculatedBmi ? bmiStatus(calculatedBmi) : '—',
                    todayCalories: h.today?.calories ?? 0,
                    todaySteps: h.today?.steps ?? 0,
                });
            }

            // --- Vehicle ---
            if (vehicleRes?.ok) {
                const v = await vehicleRes.json();
                const nextMaint = v.maintenance?.find((m: { completed: boolean; dueDate: string }) => !m.completed);
                setVehicle({
                    name: v.vehicle ? `${v.vehicle.model} ${v.vehicle.variant}` : 'Jimny JB74',
                    totalKm: v.vehicle?.currentMileage ?? 0,
                    avgFuelConsumption: v.avgKmPerLiter ? Math.round((100 / v.avgKmPerLiter) * 10) / 10 : 0,
                    nextMaintenanceDate: nextMaint?.dueDate ?? null,
                });
            }

            // --- Finance ---
            if (financeRes?.ok) {
                const f = await financeRes.json();
                setFinance({
                    totalIncome: f.totalIncome ?? 0,
                    monthlyExpense: f.totalExpense ?? 0,
                    netSavings: f.netSavings ?? 0,
                    transactionCount: f.transactionCount ?? 0,
                });
            }

            // --- Calendar ---
            if (scheduleRes?.ok) {
                const s = await scheduleRes.json();
                const todayEvts = s.today?.events ?? [];
                const nextEvt = todayEvts.length > 0
                    ? `${todayEvts[0].title}${todayEvts[0].startTime ? ` - ${todayEvts[0].startTime}` : ''}`
                    : null;
                setCalendar({
                    todayEvents: todayEvts.length,
                    weekEvents: s.week?.totalCount ?? 0,
                    nextEvent: nextEvt,
                    reminders: s.reminders ?? [],
                });
            }
        } catch (err) {
            console.error('Butler dashboard fetch error:', err);
        }
        setLoading(false);
    }, [getIdToken]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

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
                        <Link href="/system/linebot">
                            <Settings className="h-4 w-4 mr-2" />
                            LINE Bot 管理
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
                        {loading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : health?.bmi ? (
                            <>
                                <div className="text-4xl font-bold text-foreground tracking-tight">
                                    BMI {health.bmi}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                                        {health.bmiStatus}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {health.weight} kg
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-muted-foreground">尚無健康數據</div>
                        )}
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
                        {loading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : vehicle ? (
                            <>
                                <div className="text-4xl font-bold text-foreground tracking-tight">
                                    {vehicle.totalKm.toLocaleString()}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-blue-400">公里</span>
                                    {vehicle.avgFuelConsumption > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            · 油耗 {vehicle.avgFuelConsumption} L/100km
                                        </span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-muted-foreground">尚無車輛數據</div>
                        )}
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
                        {loading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : finance ? (
                            <>
                                <div className="text-4xl font-bold text-foreground tracking-tight">
                                    ${finance.monthlyExpense.toLocaleString()}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gold">
                                        本月支出
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        · {finance.transactionCount} 筆交易
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-muted-foreground">尚無財務數據</div>
                        )}
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
                        {loading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : calendar ? (
                            <>
                                <div className="text-4xl font-bold text-foreground tracking-tight">
                                    {calendar.todayEvents}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-purple-400">個事件</span>
                                    {calendar.nextEvent && (
                                        <span className="text-xs text-muted-foreground">
                                            · 下一個: {calendar.nextEvent}
                                        </span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-muted-foreground">尚無行程</div>
                        )}
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

            {/* Upcoming Reminders — from real calendar API */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-gold" />
                        即將到來的提醒
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {/* Vehicle maintenance reminder */}
                        {vehicle?.nextMaintenanceDate && (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/20">
                                        <Car className="h-4 w-4 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium">車輛保養</p>
                                        <p className="text-sm text-muted-foreground">{vehicle.name} 定期保養</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                                    {daysUntil(vehicle.nextMaintenanceDate)}
                                </Badge>
                            </div>
                        )}

                        {/* Calendar reminders from API */}
                        {calendar?.reminders?.map(r => (
                            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-purple-500/20">
                                        <Bell className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{r.title}</p>
                                        <p className="text-sm text-muted-foreground">{r.dueDate}</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-purple-400 border-purple-400/30">
                                    {daysUntil(r.dueDate)}
                                </Badge>
                            </div>
                        ))}

                        {/* Empty state */}
                        {!loading && !vehicle?.nextMaintenanceDate && (!calendar?.reminders || calendar.reminders.length === 0) && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                目前沒有待處理的提醒
                            </p>
                        )}

                        {loading && (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
