'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createAdminClient, AdminClient } from '@/lib/api/admin-client';
import { useAgentWebSocket } from '@/lib/hooks/useAgentWebSocket';
import { useWarRoomStore } from '@/lib/store/warRoomStore';
import { AGENTS_DATA } from '@/lib/constants/agents';
import { useAuth } from '@/lib/AuthContext';
import { StatCard, SPARKLINES } from '@/components/war-room/StatCard';
import { AgentBadge } from '@/components/war-room/AgentBadge';
import { LogItem, ActivityItem } from '@/components/war-room/LogItem';
import Image from 'next/image';

// ─── Main Dashboard ─────────────────────────────────────────────────────────
export default function ExecutiveDashboard() {
    useAgentWebSocket();
    const { isConnected } = useWarRoomStore();
    const { getIdToken } = useAuth();

    const [logs, setLogs] = useState<ActivityItem[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [tenants, setTenants] = useState<any[]>([]);
    const [jobs, setJobs] = useState<any[]>([]);
    const [adminClient, setAdminClient] = useState<AdminClient | null>(null);

    const logEndRef = useRef<HTMLDivElement>(null);

    // Admin client
    useEffect(() => {
        setAdminClient(createAdminClient(async () => {
            const token = await getIdToken();
            return token || '';
        }, '/api'));
    }, [getIdToken]);

    // Data fetching
    useEffect(() => {
        if (!adminClient) return;

        const fetchData = async () => {
            try {
                const logsRes = await adminClient.getLogs({ limit: 30 });
                if (logsRes?.logs) {
                    setLogs((logsRes.logs as any[]).map(log => ({
                        id:        log.id || Math.random().toString(),
                        title:     log.message || log.title || 'System Event',
                        timestamp: log.timestamp || new Date().toISOString(),
                        source:    log.source || 'SYSTEM',
                        type:      (log.level === 'error' ? 'error' : log.level === 'warn' ? 'warn' : 'info') as ActivityItem['type'],
                    })).reverse());
                }
                const statsRes = await adminClient.getStats();
                if (statsRes?.stats) setStats(statsRes.stats);

                const tenantsRes = await adminClient.getTenants();
                if (tenantsRes?.tenants) setTenants(tenantsRes.tenants);

                const jobsRes = await adminClient.getJobs({ limit: 20 });
                if (jobsRes?.jobs) setJobs(jobsRes.jobs);
            } catch (err) {
                console.error('Failed to fetch admin data:', err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 8000);
        return () => clearInterval(interval);
    }, [adminClient]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const activeJobs  = useMemo(() => jobs.filter(j => j.status === 'running' || j.status === 'pending').length, [jobs]);
    const failedJobs  = useMemo(() => jobs.filter(j => j.status === 'failed').length,  [jobs]);
    const errorCount  = useMemo(() => logs.filter(l => l.type === 'error').length,       [logs]);

    const cpuValue    = stats?.cpuUsage     ? stats.cpuUsage.toFixed(1)                                              : '—';
    const memoryValue = stats?.memoryUsage  ? Math.round(stats.memoryUsage.heapUsed / 1024 / 1024).toString()        : '—';
    const memoryUnit  = stats?.memoryUsage  ? 'MB'                                                                    : '';

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12 pt-4">
            
            {/* ── Section: System Vitality ──────────────────────────── */}
            <section className="space-y-4">
                <div className="flex justify-between items-end">
                    <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                        系統狀態
                    </h2>
                    <span className="text-xs text-primary font-medium uppercase tracking-wider">即時監控 · 8秒更新</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
                    <StatCard
                        label="CPU 使用率"
                        value={cpuValue}
                        unit="%"
                        sparkline={SPARKLINES.cpu}
                        color="primary"
                        trend="stable"
                    />
                    <StatCard
                        label="記憶體使用量"
                        value={memoryValue}
                        unit={memoryUnit || 'MB'}
                        sparkline={SPARKLINES.memory}
                        color="secondary"
                        trend="up"
                    />
                    <StatCard
                        label="執行中任務"
                        value={activeJobs}
                        sparkline={SPARKLINES.jobs}
                        color="tertiary"
                        trend={activeJobs > 5 ? 'up' : 'stable'}
                    />
                    <StatCard
                        label="失敗任務"
                        value={failedJobs}
                        sparkline={SPARKLINES.network}
                        color={failedJobs > 0 ? 'error' : 'primary'}
                        trend={failedJobs > 0 ? 'down' : 'stable'}
                    />
                    <StatCard
                        label="活躍租戶"
                        value={tenants.length}
                        sparkline={SPARKLINES.jobs}
                        color="secondary"
                        trend="stable"
                    />
                </div>
            </section>

            {/* ── Section: Neural Agents ────────────────────────────── */}
            <section className="space-y-4">
                <div className="flex justify-between items-end">
                    <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                        神經元代理
                    </h2>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        {AGENTS_DATA.filter(a => a.status === 'ONLINE').length} / {AGENTS_DATA.length} 在線
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {AGENTS_DATA.map(agent => {
                        const isActive  = agent.status === 'ONLINE' || agent.status === 'SYNCING';
                        const isBusy    = (agent.status as string) === 'BUSY';
                        const progress  = isActive ? Math.floor(Math.random() * 40 + 60) : isBusy ? Math.floor(Math.random() * 30 + 20) : 0;
                        const barColor  = isActive ? 'bg-green-500' : isBusy ? 'bg-[var(--gold-primary)]' : 'bg-muted-foreground';
                        
                        return (
                            <div key={agent.id} className="card hover:-translate-y-1 transition-transform duration-300 flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <div className={`flex items-center gap-3 ${!isActive && !isBusy ? 'opacity-50' : ''}`}>
                                        <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0">
                                            {agent.imagePath ? (
                                                <Image src={agent.imagePath} alt={agent.name} width={28} height={28} className="rounded-lg object-cover" />
                                            ) : (
                                                <span className="material-symbols-outlined text-xl text-primary">smart_toy</span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold text-foreground truncate">{agent.name}</h3>
                                            <p className="text-xs text-muted-foreground truncate">{agent.title}</p>
                                        </div>
                                    </div>
                                    <AgentBadge status={agent.status} />
                                </div>

                                {(isActive || isBusy) && (
                                    <div className="space-y-1.5 mt-2">
                                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                                            <span>{isActive ? '任務完成度' : '處理中...'}</span>
                                            <span className="text-foreground">{progress}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                            <div className={`h-full ${barColor} transition-all duration-1000`} style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Section: Job Queue ────────────────────────────────── */}
            {jobs.length > 0 && (
                <section className="space-y-4">
                    <div className="flex justify-between items-end">
                        <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                            任務佇列
                        </h2>
                        <span className="text-xs text-primary font-medium uppercase tracking-wider">總計 {jobs.length} 任務</span>
                    </div>
                    <div className="card !p-0 overflow-hidden">
                        <div className="divide-y divide-border">
                            {jobs.slice(0, 8).map(job => {
                                return (
                                    <div key={job.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <span className={`badge ${job.status === 'running' ? 'badge-success' : job.status === 'pending' ? 'badge-warning' : job.status === 'failed' ? 'badge-error' : 'bg-muted text-muted-foreground'} shrink-0 uppercase`}>
                                                {job.status}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">
                                                    {job.type || 'UNKNOWN_JOB'}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    ID: {job.id.substring(0, 12)}...
                                                </p>
                                            </div>
                                        </div>
                                        <span className="material-symbols-outlined text-muted-foreground text-xl shrink-0">chevron_right</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ── Section: Operation Logs ───────────────────────────── */}
            <section className="space-y-4">
                <div className="flex justify-between items-end">
                    <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                        運行日誌
                    </h2>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{logs.length} 筆紀錄</span>
                </div>

                {logs.length === 0 ? (
                    <div className="card flex flex-col items-center justify-center py-16 text-center">
                        <span className="material-symbols-outlined text-4xl text-muted-foreground mb-3 opacity-50">hourglass_empty</span>
                        <p className="text-sm font-medium text-muted-foreground">等待數據串流中...</p>
                    </div>
                ) : (
                    <div className="card max-h-[400px] overflow-y-auto !p-4">
                        {logs.map(log => (
                            <LogItem key={log.id} log={log} />
                        ))}
                        <div ref={logEndRef} />
                    </div>
                )}
            </section>

            <style dangerouslySetInnerHTML={{ __html: `
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
            `}} />
        </div>
    );
}
