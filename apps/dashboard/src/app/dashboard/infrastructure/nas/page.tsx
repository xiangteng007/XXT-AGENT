'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Database, HardDrive, Wifi, WifiOff, RefreshCw, Server, Layers } from 'lucide-react';

interface NasData {
  ok: boolean;
  timestamp: string;
  chromadb: {
    url: string;
    heartbeat: boolean;
    responseTime: number;
    authenticated: boolean;
    collections: string[];
    collectionCount: number;
  };
}

export default function NasDashboardPage() {
  const [data, setData] = useState<NasData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/nas');
      if (res.ok) {
        setData(await res.json());
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const chromaOk = data?.chromadb.heartbeat ?? false;
  const latency = data?.chromadb.responseTime ?? -1;

  return (
    <div className="dashboard-dark min-h-screen w-full bg-[var(--bg-primary)] font-sans text-[var(--text-primary)] p-4 md:p-8 overflow-y-auto">

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-[var(--glass-bg)] rounded-xl border border-[var(--info)]/40 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <HardDrive className="text-[var(--info)]" size={28} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-outfit, Outfit)' }}>
              NAS Memory Core
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm md:text-base md:ml-16">
            ASUSTOR AS5404T • ChromaDB Long-Term Memory • Auto-refresh 30s
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] text-sm hover:border-[var(--accent-primary)]/40 transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* ChromaDB Connection */}
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-5 hover:border-[var(--accent-primary)]/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold">ChromaDB</span>
            {chromaOk ? <Wifi size={16} className="text-[var(--success)]" /> : <WifiOff size={16} className="text-[var(--danger)]" />}
          </div>
          <div className={`text-2xl font-bold font-mono mb-1 ${chromaOk ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {chromaOk ? 'ONLINE' : 'OFFLINE'}
          </div>
          <div className="text-[var(--text-muted)] text-[10px]">
            {latency > 0 ? `${latency}ms latency` : 'No response'}
          </div>
        </div>

        {/* Collections Count */}
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-5 hover:border-[var(--accent-primary)]/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold">Collections</span>
            <Layers size={16} className="text-[var(--info)]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mb-1">
            {data?.chromadb.collectionCount ?? 0}
          </div>
          <div className="text-[var(--text-muted)] text-[10px]">
            Agent memory namespaces
          </div>
        </div>

        {/* Auth Status */}
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-5 hover:border-[var(--accent-primary)]/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold">Authentication</span>
            <Server size={16} className="text-[var(--accent-primary)]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mb-1">
            {data?.chromadb.authenticated ? 'TOKEN' : 'NONE'}
          </div>
          <div className="text-[var(--text-muted)] text-[10px]">
            {data?.chromadb.authenticated ? 'Bearer token configured' : 'Open access (LAN only)'}
          </div>
        </div>
      </div>

      {/* Connection Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Endpoint Info */}
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-[var(--info)]" />
            <h2 className="text-sm font-bold uppercase tracking-widest">Connection Details</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Endpoint</span>
              <span className="font-mono text-[var(--text-primary)] text-xs">{data?.chromadb.url ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">API Version</span>
              <span className="font-mono text-[var(--text-primary)]">v2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Transport</span>
              <span className="font-mono text-[var(--text-primary)]">Tailscale Funnel</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Fallback</span>
              <span className="font-mono text-[var(--text-primary)]">Firestore</span>
            </div>
          </div>
        </div>

        {/* Collections List */}
        <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-[var(--accent-primary)]" />
            <h2 className="text-sm font-bold uppercase tracking-widest">Agent Collections</h2>
          </div>
          {(data?.chromadb.collections ?? []).length > 0 ? (
            <div className="space-y-2">
              {data?.chromadb.collections.map((name) => (
                <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--glass-border)]">
                  <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                  <span className="font-mono text-xs text-[var(--text-primary)]">{name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database size={24} className="text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-[var(--text-muted)] text-xs">
                {chromaOk ? 'No collections yet — memories will be created on first use' : 'ChromaDB offline — connect to view collections'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
