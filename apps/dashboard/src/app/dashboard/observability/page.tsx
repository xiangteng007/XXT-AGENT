'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Activity, Gauge, Database, RefreshCw, ChevronRight, Wifi, WifiOff } from 'lucide-react';

interface AgentHealth {
  name: string;
  slug: string;
  status: 'ONLINE' | 'OFFLINE';
  responseTime: number;
}

interface ObsData {
  ok: boolean;
  timestamp: string;
  gateway: { status: string; responseTime: number; version: string };
  agents: AgentHealth[];
  summary: {
    totalAgents: number;
    onlineAgents: number;
    avgLatencyMs: number;
    allOperational: boolean;
  };
}

export default function ObservabilityPage() {
  const [data, setData] = useState<ObsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/system/observability');
      if (res.ok) {
        const json: ObsData = await res.json();
        setData(json);
        setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
      }
    } catch { /* fail silently */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const isLive = !!data;
  const allOk = data?.summary.allOperational ?? false;

  return (
    <div className="dashboard-dark min-h-screen w-full bg-[var(--bg-primary)] font-sans text-[var(--text-primary)] p-4 md:p-8 overflow-y-auto">

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-[var(--glass-bg)] rounded-xl border border-[var(--success)]/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Activity className="text-[var(--success)]" size={28} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-outfit, Outfit)' }}>
              Global Observability
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm md:text-base md:ml-16">
            {loading ? 'Connecting...' : (
              <>
                Last updated{' '}
                <span className="text-[var(--info)] font-mono font-bold">{lastUpdated}</span>
                {' '}• Auto-refresh 15s
              </>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] text-sm hover:border-[var(--accent-primary)]/40 transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {/* Global Status Banner */}
      <div className={`mb-8 border rounded-2xl px-5 py-3.5 flex items-center justify-between ${
        allOk
          ? 'bg-[var(--success)]/5 border-[var(--success)]/25'
          : 'bg-[var(--warning)]/5 border-[var(--warning)]/25'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${allOk ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
          <span className={`font-bold text-sm uppercase tracking-wider ${allOk ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
            {allOk ? 'All Systems Operational' : `${data?.summary.onlineAgents ?? 0}/${data?.summary.totalAgents ?? 0} Agents Online`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs font-mono">
          <ChevronRight size={12} />
          <span>Gateway {data?.gateway.version ? `v${data.gateway.version}` : '...'}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="flex overflow-x-auto gap-4 mb-8 snap-x snap-mandatory pb-2" style={{ scrollbarWidth: 'none' }}>
        {[
          {
            title: 'Gateway Latency',
            value: data?.gateway.responseTime && data.gateway.responseTime > 0 ? `${data.gateway.responseTime}ms` : '—',
            bar: Math.min((data?.gateway.responseTime ?? 0) / 2, 100),
            barColor: (data?.gateway.responseTime ?? 0) < 100 ? 'var(--success)' : (data?.gateway.responseTime ?? 0) < 300 ? 'var(--warning)' : 'var(--danger)',
            icon: Gauge,
            sub: (data?.gateway.responseTime ?? 0) < 100 ? 'Excellent' : (data?.gateway.responseTime ?? 0) < 300 ? 'Acceptable' : 'Slow',
          },
          {
            title: 'Avg Agent Latency',
            value: data?.summary.avgLatencyMs ? `${data.summary.avgLatencyMs}ms` : '—',
            bar: Math.min((data?.summary.avgLatencyMs ?? 0) / 3, 100),
            barColor: (data?.summary.avgLatencyMs ?? 0) < 50 ? 'var(--success)' : 'var(--warning)',
            icon: Activity,
            sub: `P across ${data?.summary.totalAgents ?? 0} agents`,
          },
          {
            title: 'Online Agents',
            value: `${data?.summary.onlineAgents ?? 0} / ${data?.summary.totalAgents ?? 0}`,
            bar: data?.summary.totalAgents ? (data.summary.onlineAgents / data.summary.totalAgents) * 100 : 0,
            barColor: data?.summary.onlineAgents === data?.summary.totalAgents ? 'var(--success)' : 'var(--warning)',
            icon: Database,
            sub: allOk ? 'All healthy' : 'Some agents down',
          },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.title} className="snap-start min-w-[240px] md:min-w-0 md:flex-1 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-5 hover:border-[var(--accent-primary)]/30 transition-all duration-300">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold">{m.title}</span>
                <Icon size={14} style={{ color: m.barColor }} />
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mb-1">{m.value}</div>
              <div className="text-[var(--text-muted)] text-[10px] mb-3">{m.sub}</div>
              <div className="h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.bar}%`, background: m.barColor, boxShadow: `0 0 6px ${m.barColor}` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent Health Grid */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--glass-bg)]">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-[var(--accent-primary)]" />
            <span className="text-sm font-bold uppercase tracking-widest">Agent Health Matrix</span>
          </div>
          {isLive && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/30">
              LIVE
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--glass-border)]">
          {(data?.agents ?? []).map((agent) => (
            <div key={agent.slug} className="bg-[var(--bg-primary)] p-4 flex items-center justify-between hover:bg-[var(--bg-elevated)] transition-colors">
              <div className="flex items-center gap-3">
                {agent.status === 'ONLINE'
                  ? <Wifi size={14} className="text-[var(--success)]" />
                  : <WifiOff size={14} className="text-[var(--danger)]" />
                }
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">{agent.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">{agent.slug}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-bold uppercase tracking-wider ${
                  agent.status === 'ONLINE' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                }`}>
                  {agent.status}
                </div>
                {agent.responseTime > 0 && (
                  <div className="text-[10px] font-mono text-[var(--text-muted)]">{agent.responseTime}ms</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
