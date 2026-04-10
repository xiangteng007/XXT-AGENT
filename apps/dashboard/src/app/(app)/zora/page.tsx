'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    HeartHandshake, Users, Package, ClipboardList,
    Plus, Search, DollarSign, TrendingUp, Loader2,
    CheckCircle2, Clock, AlertTriangle, Heart
} from 'lucide-react';

const GW = process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? 'http://localhost:3100';

/* ── Types ── */
interface Donation {
    id: string;
    donor_name: string;
    amount: number;
    currency: string;
    date: string;
    type: 'individual' | 'corporate' | 'government_grant';
    deductible: boolean;
    receipt_issued: boolean;
    project_id?: string;
    notes?: string;
}

interface Volunteer {
    id: string;
    name: string;
    phone: string;
    specialty: string;
    total_hours: number;
    status: 'active' | 'inactive';
    join_date: string;
    insured: boolean;
}

interface Project {
    id: string;
    title: string;
    type: 'government_grant' | 'self_funded' | 'corporate_sponsored';
    status: 'planning' | 'active' | 'completed' | 'suspended';
    budget: number;
    spent: number;
    start_date: string;
    end_date: string;
}

interface RescueMission {
    id: string;
    title: string;
    location: string;
    type: 'flood' | 'earthquake' | 'fire' | 'missing_person' | 'other';
    status: 'standby' | 'active' | 'completed';
    volunteer_count: number;
    start_date: string;
}

/* ── Mock Data ── */
const MOCK_DONATIONS: Donation[] = [
    { id: 'DON-2025-089', donor_name: '李先生 (匿名)', amount: 50000, currency: 'TWD', date: '2025-04-03', type: 'individual', deductible: true, receipt_issued: true },
    { id: 'DON-2025-088', donor_name: '晨星集團', amount: 200000, currency: 'TWD', date: '2025-04-02', type: 'corporate', deductible: true, receipt_issued: true, project_id: 'PRJ-001' },
    { id: 'DON-2025-087', donor_name: '王小明', amount: 3000, currency: 'TWD', date: '2025-04-01', type: 'individual', deductible: false, receipt_issued: true },
    { id: 'DON-2025-086', donor_name: '台北市社會局 (補助款)', amount: 500000, currency: 'TWD', date: '2025-03-28', type: 'government_grant', deductible: false, receipt_issued: true, project_id: 'PRJ-002' },
    { id: 'DON-2025-085', donor_name: '陳美美', amount: 5000, currency: 'TWD', date: '2025-03-27', type: 'individual', deductible: true, receipt_issued: false },
];

const MOCK_VOLUNTEERS: Volunteer[] = [
    { id: 'VOL-001', name: '黃志明', phone: '09XX-XXXXXX', specialty: '繩索救援', total_hours: 320, status: 'active', join_date: '2020-01-15', insured: true },
    { id: 'VOL-002', name: '吳雅婷', phone: '09XX-XXXXXX', specialty: '醫護急救', total_hours: 205, status: 'active', join_date: '2021-06-01', insured: true },
    { id: 'VOL-003', name: '劉建宏', phone: '09XX-XXXXXX', specialty: '水域救援', total_hours: 180, status: 'active', join_date: '2022-03-10', insured: false },
    { id: 'VOL-004', name: '林淑芬', phone: '09XX-XXXXXX', specialty: '心理輔導', total_hours: 95, status: 'inactive', join_date: '2023-01-20', insured: true },
];

const MOCK_PROJECTS: Project[] = [
    { id: 'PRJ-001', title: '偏鄉學童急救訓練計畫', type: 'corporate_sponsored', status: 'active', budget: 500000, spent: 210000, start_date: '2025-01-01', end_date: '2025-12-31' },
    { id: 'PRJ-002', title: '社區防災自主能力建構', type: 'government_grant', status: 'active', budget: 800000, spent: 312000, start_date: '2025-03-01', end_date: '2025-11-30' },
    { id: 'PRJ-003', title: '山地搜救裝備更新', type: 'self_funded', status: 'completed', budget: 150000, spent: 148500, start_date: '2024-06-01', end_date: '2024-12-31' },
];

const MOCK_MISSIONS: RescueMission[] = [
    { id: 'RSQ-2025-012', title: '宜蘭山區健行者失蹤', location: '宜蘭縣大同鄉', type: 'missing_person', status: 'active', volunteer_count: 12, start_date: '2025-04-04' },
    { id: 'RSQ-2025-011', title: '南投土石流救援支援', location: '南投縣信義鄉', type: 'flood', status: 'completed', volunteer_count: 28, start_date: '2025-03-20' },
];

/* ── Helpers ── */
function formatNTD(amount: number): string {
    if (amount >= 1_000_000) return `NT$ ${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `NT$ ${(amount / 1_000).toFixed(0)}K`;
    return `NT$ ${amount}`;
}

const DONOR_TYPE_ICONS: Record<string, string> = { individual: '👤', corporate: '🏢', government_grant: '🏛️' };
const RESCUE_TYPE_ICONS: Record<string, string> = { flood: '🌊', earthquake: '🏔️', fire: '🔥', missing_person: '🔦', other: '⚠️' };

/* ── Main Component ── */
export default function ZoraAssociationPage() {
    const [activeTab, setActiveTab] = useState<'donations' | 'volunteers' | 'projects' | 'missions'>('donations');
    const [searchQuery, setSearchQuery] = useState('');
    const [chatMsg, setChatMsg] = useState('');
    const [chatReply, setChatReply] = useState('');
    const [chatLoading, setChatLoading] = useState(false);

    const askZora = async () => {
        if (!chatMsg.trim()) return;
        setChatLoading(true);
        try {
            const res = await fetch(`${GW}/agents/zora/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: chatMsg }),
            });
            const data = await res.json() as { reply?: string; error?: string };
            setChatReply(data.reply ?? data.error ?? '無回應');
        } catch { setChatReply('連線失敗，請確認 Gateway 已啟動。'); }
        finally { setChatLoading(false); }
    };

    const totalDonations = MOCK_DONATIONS.reduce((s, d) => s + d.amount, 0);
    const pendingReceipts = MOCK_DONATIONS.filter(d => !d.receipt_issued).length;
    const activeVolunteers = MOCK_VOLUNTEERS.filter(v => v.status === 'active').length;
    const uninsuredVols = MOCK_VOLUNTEERS.filter(v => v.status === 'active' && !v.insured).length;

    const filteredDonations = MOCK_DONATIONS.filter(d =>
        d.donor_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredVolunteers = MOCK_VOLUNTEERS.filter(v =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.specialty.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <HeartHandshake className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">協會管理面板</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">綿羊 Zora · 希望災難救援協會 · 捐款、志工、任務時間軸</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2 border-white/20 hover:bg-white/5">
                        <DollarSign className="w-4 h-4" />登錄捐款
                    </Button>
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                        <Plus className="w-4 h-4" />新增志工
                    </Button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: '本月募得', value: formatNTD(totalDonations), icon: <Heart className="w-4 h-4 text-red-400" />, color: 'text-red-400' },
                    { label: '待開收據', value: `${pendingReceipts} 份`, icon: <ClipboardList className="w-4 h-4 text-amber-400" />, color: 'text-amber-400' },
                    { label: '在籍志工', value: `${activeVolunteers} 人`, icon: <Users className="w-4 h-4 text-emerald-400" />, color: 'text-emerald-400' },
                    { label: '志工未投保', value: `${uninsuredVols} 人`, icon: <AlertTriangle className="w-4 h-4 text-orange-400" />, color: 'text-orange-400' },
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

            {/* Uninsured Warning */}
            {uninsuredVols > 0 && (
                <Card className="border-orange-500/20 bg-orange-500/5">
                    <CardContent className="p-4 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
                        <p className="text-sm">
                            <span className="font-semibold text-orange-400">{uninsuredVols} 位在籍志工</span>
                            <span className="text-white/70"> 尚未投保志工意外保險。依《志願服務法》第16條，出勤前必須完成投保。</span>
                        </p>
                        <Button size="sm" variant="outline" className="shrink-0 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 ml-auto">
                            立即處理
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Tab Nav */}
            <div className="flex gap-2 border-b border-white/10">
                {[
                    { key: 'donations', label: '捐款記錄', icon: '💰' },
                    { key: 'volunteers', label: '志工管理', icon: '🙋' },
                    { key: 'projects', label: '專案計畫', icon: '📋' },
                    { key: 'missions', label: '救難任務', icon: '🚨' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as typeof activeTab)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            activeTab === tab.key
                                ? 'border-emerald-500 text-emerald-400'
                                : 'border-transparent text-muted-foreground hover:text-white'
                        }`}
                    >
                        <span>{tab.icon}</span>{tab.label}
                    </button>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            className="w-full pl-9 pr-4 py-2 text-sm bg-card/40 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-muted-foreground"
                            placeholder={activeTab === 'donations' ? '搜尋捐款人...' : '搜尋志工或特長...'}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Donations Tab */}
                    {activeTab === 'donations' && (
                        <div className="space-y-2">
                            {filteredDonations.map(d => (
                                <div key={d.id} className="p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/50 transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{DONOR_TYPE_ICONS[d.type]}</span>
                                            <div>
                                                <p className="font-medium">{d.donor_name}</p>
                                                <p className="text-xs text-muted-foreground">{d.date} · {d.id}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-lg font-bold text-emerald-400">{formatNTD(d.amount)}</span>
                                            <div className="flex gap-1">
                                                {d.deductible && <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20 text-[10px] px-1.5">可扣除</Badge>}
                                                <Badge className={`text-[10px] px-1.5 ${d.receipt_issued ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                    {d.receipt_issued ? '已開收據' : '待開收據'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Volunteers Tab */}
                    {activeTab === 'volunteers' && (
                        <div className="space-y-3">
                            {filteredVolunteers.map(v => (
                                <div key={v.id} className="p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/50 transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-lg">🙋</div>
                                            <div>
                                                <p className="font-medium">{v.name}</p>
                                                <p className="text-xs text-muted-foreground">{v.specialty} · 加入 {v.join_date}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge className={v.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/40 border-white/10'}>
                                                {v.status === 'active' ? '在籍' : '非在籍'}
                                            </Badge>
                                            {!v.insured && v.status === 'active' && (
                                                <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px]">⚠ 未投保</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-4">
                                        <span>服務時數: <span className="text-white/80 font-semibold">{v.total_hours} 小時</span></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Projects Tab */}
                    {activeTab === 'projects' && (
                        <div className="space-y-3">
                            {MOCK_PROJECTS.map(p => {
                                const pct = Math.round((p.spent / p.budget) * 100);
                                return (
                                    <div key={p.id} className="p-4 rounded-xl border border-border/40 bg-card/30">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-medium">📋 {p.title}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{p.start_date} → {p.end_date}</p>
                                            </div>
                                            <Badge className={
                                                p.status === 'active' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                                  : p.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                  : 'bg-white/5 text-white/40 border-white/10'
                                            }>
                                                {p.status === 'active' ? '進行中' : p.status === 'completed' ? '已完成' : '暫停'}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 space-y-1.5">
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>已用 {formatNTD(p.spent)}</span>
                                                <span>預算 {formatNTD(p.budget)} ({pct}%)</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct >= 90 ? '#f87171' : pct >= 70 ? '#f59e0b' : '#10b981' }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Rescue Missions Tab */}
                    {activeTab === 'missions' && (
                        <div className="space-y-3">
                            {MOCK_MISSIONS.map(m => (
                                <div key={m.id} className={`p-4 rounded-xl border transition-all ${m.status === 'active' ? 'border-red-500/30 bg-red-500/5' : 'border-border/40 bg-card/30'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{RESCUE_TYPE_ICONS[m.type]}</span>
                                            <div>
                                                <p className="font-medium">{m.title}</p>
                                                <p className="text-xs text-muted-foreground">{m.location}</p>
                                            </div>
                                        </div>
                                        <Badge className={m.status === 'active' ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}>
                                            {m.status === 'active' ? '🔴 執行中' : '✓ 已結束'}
                                        </Badge>
                                    </div>
                                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{m.volunteer_count} 位志工出勤</span>
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.start_date}</span>
                                        <span>{m.id}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Zora AI Chat */}
                <Card className="border-border/50 bg-card/40 backdrop-blur-md h-fit sticky top-4">
                    <CardHeader className="border-b border-white/5 pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <span>🐑</span>詢問綿羊 Zora
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                        <div className="min-h-[120px] max-h-[200px] overflow-y-auto text-sm text-white/70 bg-black/20 rounded-lg p-3 leading-relaxed">
                            {chatLoading
                                ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                                : chatReply || <span className="text-white/30 italic">詢問 Zora 捐款稅務、志工法規、補助申請格式...</span>
                            }
                        </div>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-white/30"
                                placeholder="輸入問題..."
                                value={chatMsg}
                                onChange={e => setChatMsg(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && void askZora()}
                            />
                            <Button size="sm" onClick={() => void askZora()} disabled={chatLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0">
                                問 →
                            </Button>
                        </div>
                        {['捐款收據如何開立？', '志工保險怎麼申請？', '本月捐款結餘多少？'].map(p => (
                            <button
                                key={p}
                                className="w-full text-left text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/10 text-white/60 hover:text-emerald-300 transition-colors border border-white/5"
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
