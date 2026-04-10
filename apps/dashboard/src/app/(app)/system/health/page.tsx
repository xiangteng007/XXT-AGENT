'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Wifi, WifiOff, AlertTriangle, Clock, RefreshCw, Zap, BarChart3 } from 'lucide-react';
import { V6_MASCOTS, type MascotConfig } from '@/lib/constants/v6-config';

const GW = process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? 'http://localhost:3100';
const POLL_INTERVAL_MS = 30_000;

/* ── Types ── */
interface AgentHealthResult {
    id: string;
    name: string;
    status: 'online' | 'offline' | 'timeout' | 'error';
    latency_ms: number;
    details?: {
        agent_id?: string;
        model?: string;
        uptime_seconds?: number;
        queue_size?: number;
    };
    error?: string;
}

interface AgentBusResponse {
    summary: {
        total: number;
        online: number;
        offline: number;
        max_latency_ms: number;
        polled_at: string;
    };
    agents: AgentHealthResult[];
}

/* ── Status Styling ── */
const STATUS_CONFIG = {
    online:  { label: '上線', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', dot: 'bg-emerald-400', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.35)]' },
    offline: { label: '離線', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', dot: 'bg-red-400', glow: '' },
    timeout: { label: '逾時', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', dot: 'bg-amber-400', glow: '' },
    error:   { label: '錯誤', color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.25)', dot: 'bg-orange-400', glow: '' },
};

/* ── Mascot Emoji Map (fallback) ── */
const MASCOT_EMOJI: Record<string, string> = {
    accountant: '🦉', finance: '🦁', guardian: '🐻', lex: '🦊',
    scout: '🐕', zora: '🐑', titan: '🐘', lumi: '🐈', rusty: '🦝',
};

function getMascot(id: string): MascotConfig | null {
    return V6_MASCOTS[id] ?? null;
}

function LatencyBar({ ms }: { ms: number }) {
    const pct = Math.min(100, Math.round((ms / 3000) * 100));
    const color = ms < 500 ? '#10b981' : ms < 1500 ? '#f59e0b' : '#f87171';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <span className="text-[11px] tabular-nums" style={{ color }}>{ms}ms</span>
        </div>
    );
}

/* ── Mock fallback data ── */
function buildMockData(): AgentBusResponse {
    const agents: AgentHealthResult[] = Object.keys(MASCOT_EMOJI).map((id, i) => ({
        id, name: getMascot(id)?.nameZh ?? id,
        status: i < 7 ? 'online' : i === 7 ? 'timeout' : 'offline',
        latency_ms: Math.floor(Math.random() * 800) + 80,
        details: { agent_id: id, model: 'qwen3:14b', uptime_seconds: Math.floor(Math.random() * 86400) },
    }));
    return {
        summary: { total: agents.length, online: 7, offline: 2, max_latency_ms: 880, polled_at: new Date().toISOString() },
        agents,
    };
}

/* ── Main Component ── */
export default function AgentHealthWallPage() {
    const [data, setData] = useState<AgentBusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastPoll, setLastPoll] = useState<Date | null>(null);
    const [countdown, setCountdown] = useState(POLL_INTERVAL_MS / 1000);
    const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');

    const poll = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${GW}/system/agent-bus`);
            if (res.ok) {
                const json = await res.json() as AgentBusResponse;
                setData(json);
            } else {
                setData(buildMockData());
            }
        } catch {
            setData(buildMockData());
        } finally {
            setLoading(false);
            setLastPoll(new Date());
            setCountdown(POLL_INTERVAL_MS / 1000);
        }
    }, []);

    useEffect(() => {
        void poll();
        const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [poll]);

    // Countdown timer
    useEffect(() => {
        if (countdown <= 0) return;
        const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
        return () => clearInterval(t);
    }, [countdown]);

    const agents = data?.agents ?? [];
    const filtered = agents.filter(a =>
        filterStatus === 'all' ? true : filterStatus === 'online' ? a.status === 'online' : a.status !== 'online'
    );
    const onlineCount = agents.filter(a => a.status === 'online').length;
    const maxLatency = data?.summary.max_latency_ms ?? 0;
    const avgLatency = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.latency_ms, 0) / agents.length) : 0;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                        <Activity className="h-6 w-6 text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Agent 健康監控牆</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            全系統 {agents.length} 位毛絨特派員的即時狀態 · 每 {POLL_INTERVAL_MS / 1000}s 自動重整
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">下次重整</p>
                        <p className="text-sm font-mono text-violet-400">{countdown}s</p>
                    </div>
                    <button
                        onClick={() => void poll()}
                        disabled={loading}
                        className="p-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
                        aria-label="立即重整"
                    >
                        <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: '在線特派員', value: `${onlineCount} / ${agents.length}`, icon: <Wifi className="w-4 h-4 text-emerald-400" />, color: 'text-emerald-400' },
                    { label: '離線/逾時', value: `${agents.length - onlineCount} 位`, icon: <WifiOff className="w-4 h-4 text-red-400" />, color: agents.length - onlineCount > 0 ? 'text-red-400' : 'text-white/40' },
                    { label: '最高延遲', value: `${maxLatency}ms`, icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, color: maxLatency > 1500 ? 'text-amber-400' : 'text-white/60' },
                    { label: '平均延遲', value: `${avgLatency}ms`, icon: <Zap className="w-4 h-4 text-violet-400" />, color: 'text-violet-400' },
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

            {/* System Health Bar */}
            <Card className="border-border/50 bg-card/40 backdrop-blur-md">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5" />系統整體健康度
                        </span>
                        <span className="text-sm font-bold" style={{ color: onlineCount / Math.max(1, agents.length) >= 0.8 ? '#10b981' : '#f59e0b' }}>
                            {agents.length > 0 ? Math.round(onlineCount / agents.length * 100) : 0}%
                        </span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                                width: agents.length > 0 ? `${(onlineCount / agents.length) * 100}%` : '0%',
                                background: onlineCount / Math.max(1, agents.length) >= 0.8
                                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                                    : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                            }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
                        <span>最後探查: {lastPoll?.toLocaleTimeString('zh-TW') ?? '—'}</span>
                        <span>總探查耗時: {data?.summary.max_latency_ms ?? '—'}ms</span>
                    </div>
                </CardContent>
            </Card>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1.5 p-1 bg-white/5 rounded-lg">
                    {[{ key: 'all', label: `全部 (${agents.length})` }, { key: 'online', label: `在線 (${onlineCount})` }, { key: 'offline', label: `離線 (${agents.length - onlineCount})` }].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilterStatus(tab.key as typeof filterStatus)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterStatus === tab.key ? 'bg-violet-600 text-white shadow' : 'text-muted-foreground hover:text-white'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Agent Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(agent => {
                    const st = STATUS_CONFIG[agent.status];
                    const mascot = getMascot(agent.id);
                    const emoji = MASCOT_EMOJI[agent.id] ?? '🤖';
                    const uptime = agent.details?.uptime_seconds;
                    const uptimeStr = uptime !== undefined
                        ? uptime > 3600 ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
                            : uptime > 60 ? `${Math.floor(uptime / 60)}m`
                            : `${uptime}s`
                        : null;

                    return (
                        <div
                            key={agent.id}
                            className={`relative p-4 rounded-xl border transition-all duration-300 ${st.glow}`}
                            style={{ backgroundColor: st.bg, borderColor: st.border }}
                        >
                            {/* Status Dot */}
                            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${st.dot} ${agent.status === 'online' ? 'animate-pulse' : ''}`} />
                                <span className="text-[11px] font-medium" style={{ color: st.color }}>{st.label}</span>
                            </div>

                            {/* Agent Identity */}
                            <div className="flex items-center gap-3 mb-3 pr-16">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border"
                                    style={{ backgroundColor: `${mascot?.colorHex ?? '#6366f1'}18`, borderColor: `${mascot?.colorHex ?? '#6366f1'}30` }}
                                >
                                    {emoji}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm" style={{ color: mascot?.colorHex ?? '#e2e8f0' }}>
                                        {mascot?.nameZh ? `${mascot.nameZh} ${mascot.role}` : agent.name}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate">{agent.id}</p>
                                </div>
                            </div>

                            {/* Latency bar */}
                            <LatencyBar ms={agent.latency_ms} />

                            {/* Details Row */}
                            <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {agent.details?.model ?? 'N/A'}
                                </span>
                                {uptimeStr && <span className="text-white/40">稼動 {uptimeStr}</span>}
                                {agent.error && (
                                    <span className="text-orange-400 truncate max-w-[120px]" title={agent.error}>⚠ {agent.error}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && !loading && (
                <div className="text-center py-16 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>目前無特派員符合篩選條件</p>
                </div>
            )}
        </div>
    );
}
