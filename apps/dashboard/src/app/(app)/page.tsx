'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { V6_ENTITIES, V6_MASCOTS } from '@/lib/constants/v6-config';
import {
    Activity,
    AlertTriangle,
    Wallet,
    FileSignature,
    Plane,
    HeartHandshake,
    ShieldCheck,
    CheckCircle2,
    Clock,
    Sparkles,
    LayoutDashboard,
    ArrowUpRight
} from 'lucide-react';

type EntityType = keyof typeof V6_ENTITIES;

export default function ExecutiveDashboard() {
    const [selectedEntity, setSelectedEntity] = useState<EntityType | 'all'>('all');

    // Mocks for visual demonstration of Executive Dashboard
    const totalAssets = 14500000;
    const monthlyIncome = 2400000;
    const monthlyExpense = 1800000;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 shadow-lg shadow-gold/10">
                        <LayoutDashboard className="h-6 w-6 text-gold" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                            集團營運總覽
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-gold/80" />
                            跨 7 大法人實體．9 位特派動物總管即時監控
                        </p>
                    </div>
                </div>

                {/* Entity Quick Filter */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide shrink-0">
                    <Badge 
                        variant={selectedEntity === 'all' ? 'default' : 'outline'}
                        className={`cursor-pointer px-4 py-1.5 text-sm transition-all ${selectedEntity === 'all' ? 'bg-white text-black hover:bg-white/90' : 'hover:bg-white/10'}`}
                        onClick={() => setSelectedEntity('all')}
                    >
                        全局視野
                    </Badge>
                    {Object.values(V6_ENTITIES).map(entity => (
                        <Badge
                            key={entity.id}
                            variant="outline"
                            className="cursor-pointer px-3 py-1.5 text-sm whitespace-nowrap transition-all border-white/10 hover:border-white/30"
                            style={{
                                backgroundColor: selectedEntity === entity.id ? `${entity.colorHex}20` : 'transparent',
                                color: selectedEntity === entity.id ? entity.colorHex : 'inherit',
                                borderColor: selectedEntity === entity.id ? `${entity.colorHex}50` : undefined
                            }}
                            onClick={() => setSelectedEntity(selectedEntity === entity.id ? 'all' : entity.id)}
                        >
                            {entity.shortName}
                        </Badge>
                    ))}
                </div>
            </header>

            {/* Top Level KPIs */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/50 bg-card/40 backdrop-blur-md hover:bg-card/60 transition-colors">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Wallet className="w-4 h-4 text-emerald-400" />
                                    全局流動資金
                                </p>
                                <p className="text-3xl font-bold tracking-tight">
                                    <span className="text-muted-foreground/50 text-xl mr-1">NT$</span>
                                    {totalAssets.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <Activity className="w-5 h-5 text-emerald-400" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm">
                            <ArrowUpRight className="w-4 h-4 text-emerald-400 mr-1" />
                            <span className="text-emerald-400 font-medium">+5.2%</span>
                            <span className="text-muted-foreground ml-2">較上月結餘</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/40 backdrop-blur-md hover:bg-card/60 transition-colors">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                    <FileSignature className="w-4 h-4 text-sky-400" />
                                    履行中合約 (Lex)
                                </p>
                                <p className="text-3xl font-bold tracking-tight">18 <span className="text-lg text-muted-foreground font-normal">份</span></p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>即將到期 2 份</span>
                                <span>審閱中 1 份</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                                <div className="h-full bg-sky-500 w-[80%] rounded-l-full" />
                                <div className="h-full bg-amber-500 w-[15%]" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/40 backdrop-blur-md hover:bg-card/60 transition-colors">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Plane className="w-4 h-4 text-orange-400" />
                                    UAV 巡檢排程 (Scout)
                                </p>
                                <p className="text-3xl font-bold tracking-tight">4 <span className="text-lg text-muted-foreground font-normal">架次</span></p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20">今日有任務</Badge>
                            <span className="text-xs text-muted-foreground truncate">大直豪宅工地 (14:00)</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/40 backdrop-blur-md hover:bg-card/60 transition-colors">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                    <HeartHandshake className="w-4 h-4 text-emerald-500" />
                                    NGO 本月募資 (Zora)
                                </p>
                                <p className="text-3xl font-bold tracking-tight">
                                    <span className="text-muted-foreground/50 text-xl mr-1">$</span>
                                    125,000
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm">
                            <span className="text-muted-foreground mr-2">進度</span>
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full w-[60%]" />
                            </div>
                            <span className="ml-2 text-emerald-400 text-xs font-bold">60%</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Animal Mascot Agents Status Matrix */}
                <Card className="lg:col-span-2 border-border/50 bg-card/40 backdrop-blur-md">
                    <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-gold" />
                            毛絨總管矩陣 (Agent Status Matrix)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {Object.values(V6_MASCOTS).map((mascot) => (
                                <div 
                                    key={mascot.id}
                                    className="group relative flex flex-col p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-crosshair overflow-hidden"
                                >
                                    <div 
                                        className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"
                                        style={{ '--mascot-color': mascot.colorHex } as React.CSSProperties}
                                    />
                                    
                                    <div className="flex justify-between items-start mb-3 z-10">
                                        <div 
                                            className="mascot-badge w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm"
                                            style={{ '--mascot-color': mascot.colorHex } as React.CSSProperties}
                                        >
                                            {/* We can replace this with an actual plush SVG/image later */}
                                            {mascot.animal.charAt(0)}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="relative flex h-2.5 w-2.5">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ '--mascot-color': mascot.colorHex } as React.CSSProperties}></span>
                                              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ '--mascot-color': mascot.colorHex } as React.CSSProperties}></span>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="z-10">
                                        <h3 className="font-semibold text-white/90 leading-tight">
                                            {mascot.animal}
                                        </h3>
                                        <p className="text-xs text-white/50 mt-1">{mascot.role}</p>
                                    </div>
                                    
                                    <div className="mt-3 pt-3 border-t border-white/5 z-10">
                                        <p className="text-[11px] text-white/40 truncate">
                                            {mascot.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Important Alerts & Tasks */}
                <Card className="border-border/50 bg-card/40 backdrop-blur-md">
                    <CardHeader className="border-b border-warning/10 bg-warning/5">
                        <CardTitle className="text-lg flex items-center gap-2 text-warning font-medium">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            近期警報與預備作業
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-white/5">
                            {[
                                { agent: 'Lex (Fox)', msg: '大直案營造合約將於 15 天後到期', time: 'Today', type: 'contract' },
                                { agent: 'Guardian (Bear)', msg: '員工團險保單需續保審批', time: 'Yesterday', type: 'insurance' },
                                { agent: 'Accountant (Owl)', msg: '第三季營業稅 401 報表待確認', time: '2d ago', type: 'tax' },
                                { agent: 'Scout (Shiba)', msg: 'M300 無人機電池循環次數逼近上限', time: '3d ago', type: 'equipment' },
                                { agent: 'Titan (Elephant)', msg: '竹北新建案 BIM 衝突檢查報告產出', time: '3d ago', type: 'engineering' },
                            ].map((alert, i) => (
                                <div key={i} className="p-4 hover:bg-white/[0.02] transition-colors flex gap-3 group cursor-pointer">
                                    <div className="mt-0.5">
                                        <div className="w-2 h-2 rounded-full bg-amber-400 group-hover:scale-125 transition-transform" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white/90 leading-snug">{alert.msg}</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-white/50 bg-white/5 px-1.5 py-0.5 rounded">
                                                {alert.agent}
                                            </span>
                                            <span className="text-xs text-white/40 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {alert.time}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
