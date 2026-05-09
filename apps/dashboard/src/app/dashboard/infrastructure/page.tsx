'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Server, Cpu, Network, Activity, Zap, Shield, RefreshCw } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'WARNING';
  responseTime: number;
  metrics: Record<string, string>;
}

interface SystemStatusData {
  ok: boolean;
  timestamp: string;
  services: ServiceStatus[];
  gpu: {
    vramUsedBytes: number;
    vramTotalBytes: number;
    vramUsedPercent: number;
    loadedModels: string[];
  };
}

const statusColorMap = {
  ONLINE: 'var(--success)',
  OFFLINE: 'var(--danger)',
  WARNING: 'var(--warning)',
} as const;

const iconMap: Record<string, typeof Server> = {
  'OpenClaw Gateway': Network,
  'Ollama Inference': Cpu,
};

export default function InfrastructurePage() {
  const [data, setData] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const json: SystemStatusData = await res.json();
        setData(json);
        setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
      }
    } catch {
      // silently fail — show stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000); // 30s refresh
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const vramPercent = data?.gpu.vramUsedPercent ?? 0;
  const vramUsedGB = data ? (data.gpu.vramUsedBytes / (1024 ** 3)).toFixed(1) : '0';
  const allOnline = data?.services.every(s => s.status === 'ONLINE') ?? false;

  return (
    <div className="dashboard-dark min-h-screen w-full bg-[var(--bg-primary)] font-sans text-[var(--text-primary)] p-4 md:p-8 overflow-y-auto">

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-[var(--glass-bg)] rounded-xl border border-[var(--success)]/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Server className="text-[var(--success)]" size={28} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-outfit, Outfit)' }}>
              Infrastructure Monitor
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm md:text-base md:ml-16">
            {loading ? 'Loading...' : (
              <>
                Last updated{' '}
                <span className="text-[var(--info)] font-mono font-bold">{lastUpdated}</span>
                {' '}• Auto-refresh 30s
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatus}
            className="flex items-center gap-2 px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] text-sm hover:border-[var(--accent-primary)]/40 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
            allOnline
              ? 'bg-[var(--success)]/10 border-[var(--success)]/30'
              : 'bg-[var(--warning)]/10 border-[var(--warning)]/30'
          }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${allOnline ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
            <span className={`text-sm font-bold uppercase tracking-widest ${allOnline ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
              {allOnline ? 'All Systems Nominal' : 'Degraded'}
            </span>
          </div>
        </div>
      </header>

      {/* Service Health Cards */}
      <div className="flex overflow-x-auto gap-4 mb-8 snap-x snap-mandatory pb-2" style={{ scrollbarWidth: 'none' }}>
        {(data?.services ?? []).map((svc) => {
          const Icon = iconMap[svc.name] || Server;
          const color = statusColorMap[svc.status];
          return (
            <div
              key={svc.name}
              className="snap-start min-w-[280px] md:min-w-0 md:flex-1 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-5 flex flex-col gap-3 hover:border-[var(--accent-primary)]/40 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={16} style={{ color }} />
                  <span className="text-[var(--text-secondary)] text-xs uppercase tracking-widest font-bold">{svc.name}</span>
                </div>
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-widest"
                  style={{ color, borderColor: `${color}40`, background: `${color}10` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
                  {svc.status}
                </div>
              </div>
              <div className="space-y-2 mt-1">
                {Object.entries(svc.metrics).map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[var(--text-muted)] text-xs">{label}</span>
                    <span className="text-[var(--text-primary)] text-sm font-mono font-bold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* GPU Card (always shown) */}
        <div className="snap-start min-w-[280px] md:min-w-0 md:flex-1 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-5 flex flex-col gap-3 hover:border-[var(--accent-primary)]/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={16} style={{ color: 'var(--info)' }} />
              <span className="text-[var(--text-secondary)] text-xs uppercase tracking-widest font-bold">GPU VRAM</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-widest"
              style={{
                color: vramPercent > 90 ? 'var(--danger)' : vramPercent > 70 ? 'var(--warning)' : 'var(--success)',
                borderColor: vramPercent > 90 ? 'var(--danger)' : vramPercent > 70 ? 'var(--warning)' : 'var(--success)',
                background: `${vramPercent > 90 ? 'var(--danger)' : vramPercent > 70 ? 'var(--warning)' : 'var(--success)'}10`,
              }}
            >
              {vramPercent}%
            </div>
          </div>
          <div className="space-y-2 mt-1">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">Usage</span>
              <span className="text-[var(--text-primary)] text-sm font-mono font-bold">{vramUsedGB} / 16 GB</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">Models</span>
              <span className="text-[var(--text-primary)] text-sm font-mono font-bold">
                {data?.gpu.loadedModels.length ?? 0} loaded
              </span>
            </div>
            {(data?.gpu.loadedModels ?? []).length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)] text-xs">Active</span>
                <span className="text-[var(--info)] text-xs font-mono truncate max-w-[160px]">
                  {data?.gpu.loadedModels.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Resource Bars */}
        <div className="lg:col-span-2 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-[var(--info)]" />
            <h2 className="text-sm font-bold uppercase tracking-widest">Host Resources (RTX 4080 SUPER)</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: 'GPU VRAM', value: vramPercent, color: vramPercent > 90 ? 'var(--danger)' : vramPercent > 70 ? 'var(--warning)' : 'var(--info)', display: `${vramUsedGB} / 16 GB` },
            ].map((r) => (
              <div key={r.label} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)] uppercase tracking-wider">{r.label}</span>
                  <span className="text-[var(--text-primary)] font-mono font-bold">{r.display}</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${r.value}%`, background: r.color, boxShadow: `0 0 6px ${r.color}` }}
                  />
                </div>
              </div>
            ))}

            {/* Loaded Models List */}
            {(data?.gpu.loadedModels ?? []).length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Loaded Models</span>
                <div className="flex flex-wrap gap-2">
                  {data?.gpu.loadedModels.map((model) => (
                    <span key={model} className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[var(--info)]/10 text-[var(--info)] border border-[var(--info)]/30">
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Network Topology */}
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-[var(--accent-primary)]" />
            <span className="text-sm font-bold uppercase tracking-widest">Network Topology</span>
          </div>
          <div className="font-mono text-xs space-y-1 text-[var(--text-secondary)]">
            <div className="text-[var(--success)]">● Telegram / LINE Bots</div>
            <div className="pl-3 text-[var(--text-muted)]">↓</div>
            <div className="text-[var(--accent-primary)]">● OpenClaw Gateway :8080</div>
            <div className="pl-3 text-[var(--text-muted)]">↓ &nbsp; ↓ &nbsp; ↓</div>
            <div className="flex gap-4">
              <span className="text-[var(--info)]">Ollama</span>
              <span className="text-[var(--success)]">Redis</span>
              <span className="text-[var(--warning)]">NAS</span>
            </div>
          </div>

          {/* Live Status Indicators */}
          <div className="mt-auto pt-4 border-t border-[var(--glass-border)] space-y-2">
            {(data?.services ?? []).map((svc) => (
              <div key={svc.name} className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">{svc.name}</span>
                <span className="font-mono font-bold" style={{ color: statusColorMap[svc.status] }}>
                  {svc.status}
                  {svc.responseTime > 0 && ` (${svc.responseTime}ms)`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
