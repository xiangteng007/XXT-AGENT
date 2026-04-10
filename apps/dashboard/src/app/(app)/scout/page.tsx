'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Plane, Battery, User, AlertTriangle, Clock,
    Plus, Search, CheckCircle2, BarChart3, Loader2,
    Shield, Wrench, MapPin
} from 'lucide-react';

const GW = process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? 'http://localhost:3100';

/* ── Types ── */
interface Mission {
    id: string;
    title: string;
    client: string;
    location: string;
    entity: string;
    mission_type: 'aerial_survey' | 'inspection' | 'agriculture' | 'search_rescue' | 'mapping' | 'other';
    status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
    pilot_id: string;
    equipment_id: string;
    flight_date: string;
    duration_min: number;
    fee: number;
    notes?: string;
    created_at: string;
}

interface Equipment {
    id: string;
    model: string;
    serial_number: string;
    status: 'airworthy' | 'maintenance' | 'retired';
    total_flight_hours: number;
    battery_cycles: number;
    max_battery_cycles: number;
    last_maintenance: string;
    next_maintenance_date: string;
}

interface Pilot {
    id: string;
    name: string;
    license_type: 'basic' | 'advanced' | 'bvlos';
    license_number: string;
    license_expiry: string;
    total_hours: number;
    status: 'active' | 'inactive';
}

/* ── Helpers ── */
const MISSION_STATUS: Record<string, { label: string; color: string }> = {
    planned:     { label: '已排程', color: '#94a3b8' },
    in_progress: { label: '執行中', color: '#38bdf8' },
    completed:   { label: '已完成', color: '#10b981' },
    cancelled:   { label: '已取消', color: '#f87171' },
};

const MISSION_TYPE_ICONS: Record<string, string> = {
    aerial_survey: '📸', inspection: '🔍', agriculture: '🌾',
    search_rescue: '🚨', mapping: '🗺️', other: '✈️',
};

function daysUntil(dateStr: string): number {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / 86_400_000);
}

/* ── Mock Data ── */
const MOCK_MISSIONS: Mission[] = [
    {
        id: 'MSN-2024-047', title: '大直豪宅工地進度空拍', client: '鳴鑫營造',
        location: '台北市中山區', entity: 'co_drone', mission_type: 'aerial_survey',
        status: 'planned', pilot_id: 'PLT-001', equipment_id: 'EQP-DJI-001',
        flight_date: '2025-04-10', duration_min: 90, fee: 35000, created_at: '2025-04-01T08:00:00Z',
    },
    {
        id: 'MSN-2024-046', title: '偏鄉物資投放地形勘查', client: '希望災難救援協會',
        location: '南投縣信義鄉', entity: 'co_drone', mission_type: 'search_rescue',
        status: 'completed', pilot_id: 'PLT-002', equipment_id: 'EQP-DJI-001',
        flight_date: '2025-03-28', duration_min: 120, fee: 0, notes: '公益任務，費用減免',
        created_at: '2025-03-25T10:00:00Z',
    },
    {
        id: 'MSN-2024-045', title: '太陽能板巡檢 - 台南廠區', client: '晨星能源',
        location: '台南市善化區', entity: 'co_drone', mission_type: 'inspection',
        status: 'completed', pilot_id: 'PLT-001', equipment_id: 'EQP-M300-001',
        flight_date: '2025-03-15', duration_min: 180, fee: 68000, created_at: '2025-03-10T09:00:00Z',
    },
];

const MOCK_EQUIPMENT: Equipment[] = [
    {
        id: 'EQP-DJI-001', model: 'DJI Mavic 3 Enterprise', serial_number: '1581F8FF0200041',
        status: 'airworthy', total_flight_hours: 342, battery_cycles: 198, max_battery_cycles: 400,
        last_maintenance: '2025-01-15', next_maintenance_date: '2025-07-15',
    },
    {
        id: 'EQP-M300-001', model: 'DJI Matrice 300 RTK', serial_number: 'M300-XXT-2022A',
        status: 'maintenance', total_flight_hours: 891, battery_cycles: 287, max_battery_cycles: 300,
        last_maintenance: '2025-03-01', next_maintenance_date: '2025-04-05',
    },
];

const MOCK_PILOTS: Pilot[] = [
    { id: 'PLT-001', name: '張志遠', license_type: 'advanced', license_number: 'UA-ADV-20220345',
      license_expiry: '2026-08-31', total_hours: 450, status: 'active' },
    { id: 'PLT-002', name: '陳美玲', license_type: 'basic', license_number: 'UA-BSC-20230156',
      license_expiry: '2025-05-15', total_hours: 180, status: 'active' },
];

/* ── Main Component ── */
export default function ScoutMissionPage() {
    const [missions, setMissions] = useState<Mission[]>(MOCK_MISSIONS);
    const [equipment, setEquipment] = useState<Equipment[]>(MOCK_EQUIPMENT);
    const [pilots, setPilots] = useState<Pilot[]>(MOCK_PILOTS);
    const [activeTab, setActiveTab] = useState<'missions' | 'equipment' | 'pilots'>('missions');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [chatMsg, setChatMsg] = useState('');
    const [chatReply, setChatReply] = useState('');
    const [chatLoading, setChatLoading] = useState(false);

    const fetchMissions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${GW}/agents/scout/mission`);
            if (res.ok) {
                const data = await res.json() as { missions?: Mission[] };
                if (data.missions?.length) setMissions(data.missions);
            }
        } catch { /* use mock */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { void fetchMissions(); }, [fetchMissions]);

    const askScout = async () => {
        if (!chatMsg.trim()) return;
        setChatLoading(true);
        try {
            const res = await fetch(`${GW}/agents/scout/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: chatMsg }),
            });
            const data = await res.json() as { reply?: string; error?: string };
            setChatReply(data.reply ?? data.error ?? '無回應');
        } catch { setChatReply('連線失敗，請確認 Gateway 已啟動。'); }
        finally { setChatLoading(false); }
    };

    const totalRevenue = missions.filter(m => m.status === 'completed').reduce((s, m) => s + m.fee, 0);
    const expiringLicenses = pilots.filter(p => daysUntil(p.license_expiry) <= 90);
    const maintenanceDue = equipment.filter(e => e.status === 'maintenance' || daysUntil(e.next_maintenance_date) <= 30);

    const filtered = missions.filter(m => {
        const matchSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase())
            || m.client.toLowerCase().includes(searchQuery.toLowerCase());
        const matchStatus = statusFilter === 'all' || m.status === statusFilter;
        return matchSearch && matchStatus;
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                        <Plane className="h-6 w-6 text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">UAV 任務管理面板</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">柴犬 Scout · 飛行任務日誌、設備折舊、飛手認證追蹤</p>
                    </div>
                </div>
                <Button className="gap-2 bg-orange-600 hover:bg-orange-500 text-white">
                    <Plus className="w-4 h-4" />新增任務
                </Button>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: '本月完成架次', value: String(missions.filter(m => m.status === 'completed').length), icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, color: 'text-emerald-400' },
                    { label: '本月飛行收入', value: `NT$ ${(totalRevenue / 1000).toFixed(0)}K`, icon: <BarChart3 className="w-4 h-4 text-orange-400" />, color: 'text-orange-400' },
                    { label: '執照即將到期', value: String(expiringLicenses.length), icon: <Shield className="w-4 h-4 text-amber-400" />, color: 'text-amber-400' },
                    { label: '設備需保養', value: String(maintenanceDue.length), icon: <Wrench className="w-4 h-4 text-red-400" />, color: 'text-red-400' },
                ].map((kpi, i) => (
                    <Card key={i} className="border-border/50 bg-card/40 backdrop-blur-md">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5">{kpi.icon}</div>
                            <div>
                                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tab Nav */}
            <div className="flex gap-2 border-b border-white/10 pb-0">
                {[
                    { key: 'missions', label: '飛行任務', icon: '✈️' },
                    { key: 'equipment', label: '設備管理', icon: '🚁' },
                    { key: 'pilots', label: '飛手認證', icon: '🧑‍✈️' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as typeof activeTab)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            activeTab === tab.key
                                ? 'border-orange-500 text-orange-400'
                                : 'border-transparent text-muted-foreground hover:text-white'
                        }`}
                    >
                        <span>{tab.icon}</span>{tab.label}
                    </button>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {/* Missions Tab */}
                    {activeTab === 'missions' && (
                        <>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        className="w-full pl-9 pr-4 py-2 text-sm bg-card/40 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 placeholder:text-muted-foreground"
                                        placeholder="搜尋任務或客戶..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <select
                                    aria-label="篩選任務狀態"
                                    title="篩選任務狀態"
                                    className="px-3 py-2 text-sm bg-card/40 border border-border/50 rounded-lg focus:outline-none"
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                >
                                    <option value="all">全部狀態</option>
                                    <option value="planned">已排程</option>
                                    <option value="in_progress">執行中</option>
                                    <option value="completed">已完成</option>
                                </select>
                            </div>
                            {loading && <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>}
                            <div className="space-y-3">
                                {filtered.map(mission => {
                                    const st = MISSION_STATUS[mission.status] ?? MISSION_STATUS['planned']!;
                                    return (
                                        <div key={mission.id} className="p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/50 transition-all">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl">{MISSION_TYPE_ICONS[mission.mission_type]}</span>
                                                    <div>
                                                        <p className="font-medium">{mission.title}</p>
                                                        <p className="text-xs text-muted-foreground">{mission.client} · {mission.location}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    {mission.fee > 0
                                                        ? <span className="text-sm font-bold text-orange-400">NT$ {(mission.fee / 1000).toFixed(0)}K</span>
                                                        : <span className="text-xs text-emerald-400">公益任務</span>
                                                    }
                                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: st.color, backgroundColor: `${st.color}15` }}>{st.label}</span>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{mission.flight_date}</span>
                                                <span>{mission.duration_min} 分鐘</span>
                                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{mission.id}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Equipment Tab */}
                    {activeTab === 'equipment' && (
                        <div className="space-y-3">
                            {equipment.map(eq => {
                                const batteryPct = Math.round((eq.battery_cycles / eq.max_battery_cycles) * 100);
                                const nearLimit = batteryPct >= 80;
                                return (
                                    <div key={eq.id} className="p-4 rounded-xl border border-border/40 bg-card/30">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-medium">🚁 {eq.model}</p>
                                                <p className="text-xs text-muted-foreground">SN: {eq.serial_number}</p>
                                            </div>
                                            <Badge className={
                                                eq.status === 'airworthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                  : eq.status === 'maintenance' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }>
                                                {eq.status === 'airworthy' ? '適航' : eq.status === 'maintenance' ? '保養中' : '退役'}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground flex items-center gap-1"><Battery className="w-3 h-3" />電池循環</span>
                                                <span className={nearLimit ? 'text-amber-400 font-bold' : ''}>{eq.battery_cycles} / {eq.max_battery_cycles}</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all" style={{ width: `${batteryPct}%`, backgroundColor: nearLimit ? '#f59e0b' : '#10b981' }} />
                                            </div>
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>總飛行 {eq.total_flight_hours} 小時</span>
                                                <span>下次保養: {eq.next_maintenance_date}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pilots Tab */}
                    {activeTab === 'pilots' && (
                        <div className="space-y-3">
                            {pilots.map(pilot => {
                                const days = daysUntil(pilot.license_expiry);
                                const expiringSoon = days <= 90;
                                return (
                                    <div key={pilot.id} className={`p-4 rounded-xl border transition-all ${expiringSoon ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/40 bg-card/30'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-lg">🧑‍✈️</div>
                                                <div>
                                                    <p className="font-medium">{pilot.name}</p>
                                                    <p className="text-xs text-muted-foreground">{pilot.license_number}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge className={`text-xs ${pilot.license_type === 'advanced' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-white/10 text-white/60 border-white/10'}`}>
                                                    {pilot.license_type === 'advanced' ? '進階' : pilot.license_type === 'bvlos' ? 'BVLOS' : '基礎'}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                                            <span>累計飛行: {pilot.total_hours} 小時</span>
                                            <span className={`flex items-center gap-1 ${expiringSoon ? 'text-amber-400 font-bold' : ''}`}>
                                                {expiringSoon && <AlertTriangle className="w-3 h-3" />}
                                                執照到期: {pilot.license_expiry} ({days > 0 ? `剩 ${days} 天` : '已到期'})
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Scout AI Chat */}
                <Card className="border-border/50 bg-card/40 backdrop-blur-md h-fit sticky top-4">
                    <CardHeader className="border-b border-white/5 pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <span>🐕</span>詢問柴犬 Scout
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                        <div className="min-h-[120px] max-h-[200px] overflow-y-auto text-sm text-white/70 bg-black/20 rounded-lg p-3 leading-relaxed">
                            {chatLoading
                                ? <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                                : chatReply || <span className="text-white/30 italic">詢問 Scout 航空法規、任務規劃、空域查詢...</span>
                            }
                        </div>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 placeholder:text-white/30"
                                placeholder="輸入問題..."
                                value={chatMsg}
                                onChange={e => setChatMsg(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && void askScout()}
                            />
                            <Button size="sm" onClick={() => void askScout()} disabled={chatLoading} className="bg-orange-600 hover:bg-orange-500 text-white shrink-0">
                                問 →
                            </Button>
                        </div>
                        {['查詢台北市禁航區', 'DJI M300 今天可以飛嗎？', '陳飛手的執照什麼時候過期？'].map(p => (
                            <button
                                key={p}
                                className="w-full text-left text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-orange-500/10 text-white/60 hover:text-orange-300 transition-colors border border-white/5"
                                onClick={() => setChatMsg(p)}
                            >
                                {p}
                            </button>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
