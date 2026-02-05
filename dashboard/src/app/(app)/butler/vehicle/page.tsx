'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Car,
    Fuel,
    Wrench,
    Calendar,
    Plus,
    ArrowLeft,
    Gauge,
    AlertTriangle,
} from 'lucide-react';

// Mock vehicle data
const vehicleData = {
    info: {
        name: 'Suzuki Jimny JB74',
        year: 2023,
        plate: 'ABC-1234',
        color: '叢林綠',
    },
    stats: {
        totalKm: 15680,
        avgFuelConsumption: 8.2,
        lastRefuelDate: '2026-01-28',
        nextMaintenanceKm: 20000,
        nextMaintenanceDate: '2026-03-15',
    },
    fuelLog: [
        { date: '2026-01-28', liters: 35.5, cost: 1243, km: 15680, pricePerLiter: 35.0 },
        { date: '2026-01-15', liters: 38.2, cost: 1337, km: 15250, pricePerLiter: 35.0 },
        { date: '2026-01-02', liters: 36.8, cost: 1288, km: 14820, pricePerLiter: 35.0 },
    ],
    maintenanceLog: [
        { date: '2025-12-01', type: '定期保養', km: 10000, cost: 3500, description: '機油更換、輪胎調校' },
        { date: '2025-06-15', type: '定期保養', km: 5000, cost: 2800, description: '機油更換、空氣濾芯' },
    ],
};

export default function VehiclePage() {
    const remainingKm = vehicleData.stats.nextMaintenanceKm - vehicleData.stats.totalKm;
    const maintenanceDue = remainingKm < 1000;

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
                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20">
                        <Car className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">車輛管理</h1>
                        <p className="text-muted-foreground">{vehicleData.info.name}</p>
                    </div>
                </div>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    記錄加油
                </Button>
            </div>

            {/* Vehicle Info Card */}
            <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-6">
                        <div className="p-4 rounded-2xl bg-blue-500/20">
                            <Car className="h-12 w-12 text-blue-400" />
                        </div>
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">車型</p>
                                <p className="font-bold">{vehicleData.info.name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">年份</p>
                                <p className="font-bold">{vehicleData.info.year}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">車牌</p>
                                <p className="font-bold">{vehicleData.info.plate}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">顏色</p>
                                <p className="font-bold">{vehicleData.info.color}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4 animate-stagger">
                <Card className="bg-card border-blue-500/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">總里程</CardTitle>
                        <Gauge className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold">{vehicleData.stats.totalKm.toLocaleString()}</div>
                        <span className="text-xs text-blue-400">公里</span>
                    </CardContent>
                </Card>

                <Card className="bg-card border-gold/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">平均油耗</CardTitle>
                        <Fuel className="h-4 w-4 text-gold" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold">{vehicleData.stats.avgFuelConsumption}</div>
                        <span className="text-xs text-gold">L/100km</span>
                    </CardContent>
                </Card>

                <Card className={`bg-card relative overflow-hidden card-glow card-lift ${maintenanceDue ? 'border-red-500/30' : 'border-emerald-500/30'}`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${maintenanceDue ? 'from-red-500/10' : 'from-emerald-500/10'} to-transparent pointer-events-none`} />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">下次保養</CardTitle>
                        <Wrench className={`h-4 w-4 ${maintenanceDue ? 'text-red-400' : 'text-emerald-400'}`} />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-4xl font-bold">{remainingKm.toLocaleString()}</div>
                        <span className={`text-xs ${maintenanceDue ? 'text-red-400' : 'text-emerald-400'}`}>
                            公里後 · {vehicleData.stats.nextMaintenanceDate}
                        </span>
                    </CardContent>
                </Card>

                <Card className="bg-card border-purple-500/30 relative overflow-hidden card-glow card-lift">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                        <CardTitle className="text-sm font-medium text-muted-foreground">上次加油</CardTitle>
                        <Calendar className="h-4 w-4 text-purple-400" />
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="text-2xl font-bold">{vehicleData.stats.lastRefuelDate}</div>
                        <span className="text-xs text-purple-400">8 天前</span>
                    </CardContent>
                </Card>
            </div>

            {/* Fuel Log */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Fuel className="h-5 w-5 text-gold" />
                        加油記錄
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {vehicleData.fuelLog.map((entry, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-gold/20">
                                        <Fuel className="h-4 w-4 text-gold" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{entry.liters} 公升</p>
                                        <p className="text-sm text-muted-foreground">{entry.date} · {entry.km.toLocaleString()} km</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">NT${entry.cost.toLocaleString()}</p>
                                    <p className="text-xs text-muted-foreground">${entry.pricePerLiter}/L</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Maintenance Log */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5 text-blue-400" />
                        保養記錄
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {vehicleData.maintenanceLog.map((entry, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/20">
                                        <Wrench className="h-4 w-4 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{entry.type}</p>
                                        <p className="text-sm text-muted-foreground">{entry.date} · {entry.km.toLocaleString()} km</p>
                                        <p className="text-xs text-muted-foreground">{entry.description}</p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                                    NT${entry.cost.toLocaleString()}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
