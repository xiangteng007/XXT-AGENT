'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Car,
    ArrowLeft,
    Fuel,
    Wrench,
    Gauge,
    Loader2,
    CheckCircle2,
    AlertTriangle,
} from 'lucide-react';

interface VehicleData {
    vehicle: {
        make: string;
        model: string;
        variant: string;
        year: number;
        licensePlate: string;
        currentMileage: number;
    } | null;
    fuelLogs: Array<{
        id: string;
        date: string;
        liters: number;
        pricePerLiter: number;
        totalCost: number;
        mileage: number;
        kmPerLiter: number;
    }>;
    maintenance: Array<{
        id: string;
        type: string;
        description: string;
        dueDate: string;
        dueMileage: number;
        completed: boolean;
    }>;
    avgKmPerLiter: number | null;
}

export default function VehiclePage() {
    const [data, setData] = useState<VehicleData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/butler/vehicle')
            .then(r => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
        );
    }

    const v = data?.vehicle;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/butler">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20">
                    <Car className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">車輛管理</h1>
                    <p className="text-muted-foreground">
                        {v ? `${v.make} ${v.model} ${v.variant}` : '尚未設定車輛'}
                    </p>
                </div>
            </div>

            {/* Vehicle Stats */}
            {v && (
                <div className="grid gap-4 md:grid-cols-3 animate-stagger">
                    <Card className="bg-card border-blue-500/30 relative overflow-hidden card-glow card-lift">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
                        <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                            <CardTitle className="text-sm font-medium text-muted-foreground">總里程</CardTitle>
                            <Gauge className="h-4 w-4 text-blue-400" />
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-4xl font-bold text-blue-400">
                                {v.currentMileage.toLocaleString()}
                            </div>
                            <span className="text-xs text-muted-foreground">km</span>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-emerald-500/30 relative overflow-hidden card-glow card-lift">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
                        <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                            <CardTitle className="text-sm font-medium text-muted-foreground">平均油耗</CardTitle>
                            <Fuel className="h-4 w-4 text-emerald-400" />
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-4xl font-bold text-emerald-400">
                                {data?.avgKmPerLiter ?? '—'}
                            </div>
                            <span className="text-xs text-muted-foreground">km/L</span>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-gold/30 relative overflow-hidden card-glow card-lift">
                        <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent pointer-events-none" />
                        <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                            <CardTitle className="text-sm font-medium text-muted-foreground">車牌</CardTitle>
                            <Car className="h-4 w-4 text-gold" />
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-2xl font-bold text-gold">{v.licensePlate}</div>
                            <span className="text-xs text-muted-foreground">{v.year} 年式</span>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Fuel Logs */}
            {data?.fuelLogs && data.fuelLogs.length > 0 && (
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Fuel className="h-5 w-5 text-emerald-400" />
                            加油記錄
                            <Badge variant="outline" className="ml-2">{data.fuelLogs.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.fuelLogs.map((log) => (
                                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                    <div>
                                        <p className="font-medium">{log.liters}L × ${log.pricePerLiter}/L</p>
                                        <p className="text-sm text-muted-foreground">{log.date} · {log.mileage?.toLocaleString()} km</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gold">${log.totalCost.toLocaleString()}</p>
                                        {log.kmPerLiter > 0 && (
                                            <p className="text-xs text-emerald-400">{log.kmPerLiter} km/L</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Maintenance Schedule */}
            {data?.maintenance && data.maintenance.length > 0 && (
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-orange-400" />
                            保養排程
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.maintenance.map((m) => (
                                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${m.completed ? 'bg-emerald-500/20' : 'bg-orange-500/20'}`}>
                                            {m.completed ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                            ) : (
                                                <AlertTriangle className="h-4 w-4 text-orange-400" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium">{m.description || m.type}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {m.dueDate}{m.dueMileage ? ` · ${m.dueMileage.toLocaleString()} km` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={m.completed ? 'secondary' : 'outline'} className={m.completed ? '' : 'border-orange-400/30 text-orange-400'}>
                                        {m.completed ? '已完成' : '待保養'}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty state */}
            {!v && (
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardContent className="py-12 text-center">
                        <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">尚未設定車輛</h3>
                        <p className="text-muted-foreground">透過 LINE 傳送「加油 45L 32.5」開始追蹤</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
