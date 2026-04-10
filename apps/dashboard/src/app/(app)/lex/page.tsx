'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    FileSignature, AlertTriangle, Clock, CheckCircle2,
    Plus, Search, Filter, ChevronRight, Calendar,
    DollarSign, TrendingUp, X, Loader2
} from 'lucide-react';

const GW = process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? 'http://localhost:3100';

/* ── Types ── */
interface Contract {
    id: string;
    title: string;
    party: string;
    entity: string;
    contract_type: 'construction' | 'design' | 'service' | 'procurement' | 'drone_service' | 'other';
    status: 'draft' | 'active' | 'completed' | 'terminated' | 'expired';
    value: number;
    currency: string;
    sign_date: string;
    start_date: string;
    end_date: string;
    milestones?: Milestone[];
    created_at: string;
}

interface Milestone {
    id: string;
    name: string;
    due_date: string;
    amount: number;
    status: 'pending' | 'invoiced' | 'paid';
}

interface ExpiringContract {
    id: string;
    title: string;
    end_date: string;
    days_remaining: number;
    party: string;
    entity: string;
}

/* ── Helpers ── */
const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    draft:       { label: '草稿', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    active:      { label: '履行中', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
    completed:   { label: '已完成', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    terminated:  { label: '終止', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
    expired:     { label: '已到期', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

const TYPE_ICONS: Record<string, string> = {
    construction: '🏗️', design: '✏️', service: '🤝',
    procurement: '📦', drone_service: '✈️', other: '📄',
};

function daysUntil(dateStr: string): number {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatNTD(amount: number): string {
    if (amount >= 1_000_000) return `NT$ ${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `NT$ ${(amount / 1_000).toFixed(0)}K`;
    return `NT$ ${amount}`;
}

/* ── Mock data for UI demonstration ── */
const MOCK_CONTRACTS: Contract[] = [
    {
        id: 'CTR-2024-001', title: '大直豪宅新建工程合約', party: '美聯建設股份有限公司',
        entity: 'co_construction', contract_type: 'construction', status: 'active',
        value: 45000000, currency: 'TWD', sign_date: '2024-03-01',
        start_date: '2024-04-01', end_date: '2026-04-15',
        milestones: [
            { id: 'm1', name: '地基工程完成', due_date: '2024-09-01', amount: 9000000, status: 'paid' },
            { id: 'm2', name: '結構體完成', due_date: '2025-03-01', amount: 13500000, status: 'paid' },
            { id: 'm3', name: '外牆完成', due_date: '2025-09-01', amount: 9000000, status: 'invoiced' },
            { id: 'm4', name: '竣工驗收', due_date: '2026-04-15', amount: 13500000, status: 'pending' },
        ],
        created_at: '2024-03-01T08:00:00Z',
    },
    {
        id: 'CTR-2024-002', title: '竹北三代宅空間設計合約', party: '林氏私人委託',
        entity: 'co_design', contract_type: 'design', status: 'active',
        value: 2800000, currency: 'TWD', sign_date: '2024-06-15',
        start_date: '2024-07-01', end_date: '2024-12-31',
        milestones: [
            { id: 'm1', name: '設計定案', due_date: '2024-09-30', amount: 1120000, status: 'paid' },
            { id: 'm2', name: '施工圖交付', due_date: '2024-12-31', amount: 1680000, status: 'pending' },
        ],
        created_at: '2024-06-15T10:00:00Z',
    },
    {
        id: 'CTR-2024-003', title: '希望協會工地空拍合約', party: '希望災難救援協會',
        entity: 'co_drone', contract_type: 'drone_service', status: 'active',
        value: 120000, currency: 'TWD', sign_date: '2024-11-01',
        start_date: '2024-11-15', end_date: '2025-01-15',
        milestones: [
            { id: 'm1', name: '第一批次空拍', due_date: '2024-12-01', amount: 60000, status: 'paid' },
            { id: 'm2', name: '第二批次空拍', due_date: '2025-01-15', amount: 60000, status: 'pending' },
        ],
        created_at: '2024-11-01T09:00:00Z',
    },
    {
        id: 'CTR-2023-008', title: '信義區辦公室翻新合約', party: '永昇資產管理',
        entity: 'co_renovation', contract_type: 'construction', status: 'completed',
        value: 8500000, currency: 'TWD', sign_date: '2023-04-01',
        start_date: '2023-05-01', end_date: '2023-11-30',
        created_at: '2023-04-01T08:00:00Z',
    },
];

const MOCK_EXPIRING: ExpiringContract[] = [
    { id: 'CTR-2024-003', title: '希望協會工地空拍合約', end_date: '2025-01-15', days_remaining: 10, party: '希望災難救援協會', entity: 'co_drone' },
    { id: 'CTR-2024-002', title: '竹北三代宅空間設計合約', end_date: '2024-12-31', days_remaining: 26, party: '林氏私人委託', entity: 'co_design' },
];

/* ── Main Component ── */
export default function LexContractPage() {
    const [contracts, setContracts] = useState<Contract[]>(MOCK_CONTRACTS);
    const [expiring, setExpiring] = useState<ExpiringContract[]>(MOCK_EXPIRING);
    const [selected, setSelected] = useState<Contract | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [loading, setLoading] = useState(false);
    const [chatMsg, setChatMsg] = useState('');
    const [chatReply, setChatReply] = useState('');
    const [chatLoading, setChatLoading] = useState(false);

    const fetchContracts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${GW}/agents/lex/contract`);
            if (res.ok) {
                const data = await res.json() as { contracts?: Contract[] };
                if (data.contracts?.length) setContracts(data.contracts);
            }
        } catch { /* use mock */ } finally { setLoading(false); }
    }, []);

    const fetchExpiring = useCallback(async () => {
        try {
            const res = await fetch(`${GW}/agents/lex/contract/expiring`);
            if (res.ok) {
                const data = await res.json() as { expiring_contracts?: ExpiringContract[] };
                if (data.expiring_contracts?.length) setExpiring(data.expiring_contracts);
            }
        } catch { /* use mock */ }
    }, []);

    useEffect(() => {
        void fetchContracts();
        void fetchExpiring();
    }, [fetchContracts, fetchExpiring]);

    const askLex = async () => {
        if (!chatMsg.trim()) return;
        setChatLoading(true);
        try {
            const res = await fetch(`${GW}/agents/lex/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: chatMsg }),
            });
            const data = await res.json() as { reply?: string; error?: string };
            setChatReply(data.reply ?? data.error ?? '無回應');
        } catch { setChatReply('連線失敗，請確認 Gateway 已啟動。'); }
        finally { setChatLoading(false); }
    };

    const filtered = contracts.filter(c => {
        const matchSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.party.toLowerCase().includes(searchQuery.toLowerCase());
        const matchStatus = statusFilter === 'all' || c.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const totalValue = contracts.filter(c => c.status === 'active')
        .reduce((sum, c) => sum + c.value, 0);
    const activeCount = contracts.filter(c => c.status === 'active').length;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                        <FileSignature className="h-6 w-6 text-sky-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">合約管理面板</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">雪狐 Lex · 跨法人實體合約電子化與到期追蹤</p>
                    </div>
                </div>
                <Button className="gap-2 bg-sky-600 hover:bg-sky-500 text-white">
                    <Plus className="w-4 h-4" />新增合約
                </Button>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: '履行中合約', value: String(activeCount), icon: <FileSignature className="w-4 h-4 text-sky-400" />, color: 'text-sky-400' },
                    { label: '合約總金額', value: formatNTD(totalValue), icon: <DollarSign className="w-4 h-4 text-emerald-400" />, color: 'text-emerald-400' },
                    { label: '即將到期', value: String(expiring.length), icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, color: 'text-amber-400' },
                    { label: '已完成合約', value: String(contracts.filter(c => c.status === 'completed').length), icon: <CheckCircle2 className="w-4 h-4 text-violet-400" />, color: 'text-violet-400' },
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

            {/* Expiring Alerts */}
            {expiring.length > 0 && (
                <Card className="border-amber-500/20 bg-amber-500/5">
                    <CardHeader className="py-3 px-5 border-b border-amber-500/10">
                        <CardTitle className="text-sm font-medium text-amber-400 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />即將到期合約警示
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {expiring.map(e => (
                            <div key={e.id} className="flex items-center justify-between px-5 py-3 border-b border-amber-500/5 last:border-0 hover:bg-amber-500/5 transition-colors">
                                <div>
                                    <p className="text-sm font-medium">{e.title}</p>
                                    <p className="text-xs text-muted-foreground">{e.party}</p>
                                </div>
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                                    剩 {e.days_remaining} 天
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Contract List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                className="w-full pl-9 pr-4 py-2 text-sm bg-card/40 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500/50 placeholder:text-muted-foreground"
                                placeholder="搜尋合約名稱或廠商..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <select
                            aria-label="篩選合約狀態"
                            title="篩選合約狀態"
                            className="px-3 py-2 text-sm bg-card/40 border border-border/50 rounded-lg focus:outline-none"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">全部狀態</option>
                            <option value="active">履行中</option>
                            <option value="draft">草稿</option>
                            <option value="completed">已完成</option>
                            <option value="expired">已到期</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        {loading && <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>}
                        {filtered.map(contract => {
                            const st = STATUS_LABELS[contract.status] ?? STATUS_LABELS['draft']!;
                            const days = daysUntil(contract.end_date);
                            const isSelected = selected?.id === contract.id;
                            return (
                                <div
                                    key={contract.id}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-sky-500/50 bg-sky-500/5' : 'border-border/40 bg-card/30 hover:bg-card/50'}`}
                                    onClick={() => setSelected(isSelected ? null : contract)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-xl shrink-0">{TYPE_ICONS[contract.contract_type]}</span>
                                            <div className="min-w-0">
                                                <p className="font-medium truncate">{contract.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">{contract.party}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span className="text-sm font-bold text-white/90">{formatNTD(contract.value)}</span>
                                            <Badge style={{ color: st.color, backgroundColor: st.bg, border: `1px solid ${st.color}40` }} className="text-xs">
                                                {st.label}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Milestones Gantt Bar */}
                                    {isSelected && contract.milestones && contract.milestones.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/5">
                                            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />付款節點</p>
                                            <div className="space-y-2">
                                                {contract.milestones.map(m => (
                                                    <div key={m.id} className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{
                                                            backgroundColor: m.status === 'paid' ? '#10b981' : m.status === 'invoiced' ? '#f59e0b' : '#475569'
                                                        }} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs truncate">{m.name}</p>
                                                            <p className="text-[11px] text-muted-foreground">{m.due_date} · {formatNTD(m.amount)}</p>
                                                        </div>
                                                        <span className="text-[11px] shrink-0" style={{ color: m.status === 'paid' ? '#10b981' : m.status === 'invoiced' ? '#f59e0b' : '#64748b' }}>
                                                            {m.status === 'paid' ? '✓ 已付款' : m.status === 'invoiced' ? '⏳ 請款中' : '· 待付'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {days > 0 ? `${days} 天後到期` : `已到期 ${Math.abs(days)} 天`}
                                        </span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Lex AI Chat Panel */}
                <Card className="border-border/50 bg-card/40 backdrop-blur-md h-fit sticky top-4">
                    <CardHeader className="border-b border-white/5 pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <span>🦊</span>詢問雪狐 Lex
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                        <div className="min-h-[120px] max-h-[200px] overflow-y-auto text-sm text-white/70 bg-black/20 rounded-lg p-3 leading-relaxed">
                            {chatLoading
                                ? <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                                : chatReply || <span className="text-white/30 italic">詢問 Lex 合約條款分析、到期提醒、風險評估...</span>
                            }
                        </div>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500/50 placeholder:text-white/30"
                                placeholder="輸入問題..."
                                value={chatMsg}
                                onChange={e => setChatMsg(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && void askLex()}
                            />
                            <Button size="sm" onClick={() => void askLex()} disabled={chatLoading} className="bg-sky-600 hover:bg-sky-500 text-white shrink-0">
                                問 →
                            </Button>
                        </div>
                        {/* Quick prompts */}
                        <div className="space-y-1.5">
                            {['列出即將到期的合約', '分析違約金條款風險', '這週有哪些付款節點？'].map(p => (
                                <button
                                    key={p}
                                    className="w-full text-left text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-sky-500/10 text-white/60 hover:text-sky-300 transition-colors border border-white/5"
                                    onClick={() => { setChatMsg(p); }}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
