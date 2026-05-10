'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Bot, Copy, RefreshCw, AlertTriangle, MessageSquare, Users, Zap } from 'lucide-react';

interface LiveBotStatus {
  id: string;
  platform: string;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  responseTime: number;
}

const bots = [
  {
    id: 'telegram',
    platform: 'Telegram',
    handle: '@XXT_MAIN_BOT',
    initials: 'TG',
    color: '#2AABEE',
    statusLabel: 'Online (Polling)',
    statusVar: 'var(--success)',
    stats: [
      { label: 'Messages (24h)', value: '1,244', icon: MessageSquare },
      { label: 'Active Users', value: '42', icon: Users },
      { label: 'Avg Response', value: '1.2s', icon: Zap },
    ],
    webhookUrl: 'https://api.xxt-agent.com/v1/webhook/telegram/alpha-node',
    primaryAction: { label: 'Broadcast Alert', color: '#2AABEE' },
    secondaryAction: { label: 'Restart Poller' },
  },
  {
    id: 'line',
    platform: 'LINE',
    handle: '@XXT_Field_Ops',
    initials: 'LN',
    color: '#06C755',
    statusLabel: 'Online (Webhook)',
    statusVar: 'var(--success)',
    stats: [
      { label: 'Messages (24h)', value: '892', icon: MessageSquare },
      { label: 'Active Users', value: '18', icon: Users },
      { label: 'Avg Response', value: '0.9s', icon: Zap },
    ],
    webhookUrl: 'https://api.xxt-agent.com/v1/webhook/line/field-node',
    primaryAction: { label: 'Send Rich Menu', color: '#06C755' },
    secondaryAction: { label: 'Verify Signature' },
  },
];

export default function BotIntegrationPage() {
  const [liveStatuses, setLiveStatuses] = useState<LiveBotStatus[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/bots');
      if (res.ok) {
        const json = await res.json();
        setLiveStatuses(json.bots ?? []);
        setIsLive(json.bots?.some((b: LiveBotStatus) => b.status === 'ONLINE') ?? false);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Merge live status into static bot data
  const getBotStatus = (botId: string) => {
    const live = liveStatuses.find(l => l.id === botId);
    if (!live) return { label: 'Checking...', color: 'var(--text-muted)' };
    return {
      label: live.status === 'ONLINE' ? `Online (${live.responseTime}ms)` : live.status === 'UNKNOWN' ? 'Unknown' : 'Offline',
      color: live.status === 'ONLINE' ? 'var(--success)' : live.status === 'UNKNOWN' ? 'var(--warning)' : 'var(--danger)',
    };
  };

  return (
    <div className="dashboard-dark min-h-screen w-full bg-[var(--bg-primary)] font-sans text-[var(--text-primary)] p-4 md:p-8 overflow-y-auto">
      {/* Dynamic Banner */}
      <div className={`mb-4 px-4 py-2.5 rounded-xl border flex items-center gap-2 text-xs ${
        isLive
          ? 'border-[var(--success)]/30 bg-[var(--success)]/5 text-[var(--success)]'
          : 'border-[var(--warning)]/30 bg-[var(--warning)]/5 text-[var(--warning)]'
      }`}>
        <span className="font-bold uppercase tracking-widest">{isLive ? '🟢 LIVE' : '⚠️ SHOWCASE'}</span>
        <span className="text-[var(--text-muted)]">
          {isLive
            ? `Gateway 已連線 — 即時偵測 Bot 狀態`
            : '統計數據為展示用假資料，Bot 狀態偵測中...'
          }
        </span>
        <button onClick={fetchStatus} className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-[var(--glass-bg)] rounded-xl border border-[var(--info)]/40 shadow-[0_0_15px_rgba(99,179,237,0.15)]">
              <Bot className="text-[var(--info)]" size={28} strokeWidth={1.5} />
            </div>
            <h1
              className="text-3xl md:text-4xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-outfit, Outfit)' }}
            >
              Bot Control Center
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm md:text-base md:ml-16">
            Manage dual-channel Telegram &amp; LINE communication nodes
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/40 rounded-xl text-[var(--accent-primary)] text-sm font-bold uppercase tracking-widest hover:bg-[var(--accent-primary)]/20 transition-all">
          <Zap size={14} />
          Add Webhook
        </button>
      </header>

      {/* Bot Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {bots.map((bot) => (
          <div
            key={bot.id}
            className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl overflow-hidden hover:border-[var(--accent-primary)]/30 transition-all duration-300"
          >
            {/* Card Header */}
            <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm"
                  style={{ background: bot.color, boxShadow: `0 0 12px ${bot.color}40` }}
                >
                  {bot.initials}
                </div>
                <div>
                  <div className="text-[var(--text-primary)] font-bold text-base tracking-wide">{bot.handle}</div>
                  <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest">{bot.platform}</div>
                </div>
              </div>
              {/* Status Badge — Live from API */}
              {(() => {
                const st = getBotStatus(bot.id);
                return (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-widest" style={{ color: st.color, borderColor: `${st.color}40`, background: `${st.color}10` }}>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: st.color }} />
                    {st.label}
                  </div>
                );
              })()}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-0 border-b border-[var(--glass-border)]">
              {bot.stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="px-4 py-4 flex flex-col gap-1 border-r border-[var(--glass-border)] last:border-r-0">
                    <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
                      <Icon size={10} />
                      {stat.label}
                    </div>
                    <div className="text-[var(--text-primary)] text-xl font-bold font-mono" style={{ color: bot.color }}>
                      {stat.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Webhook URL */}
            <div className="px-6 py-4 border-b border-[var(--glass-border)]">
              <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold mb-2">Webhook Endpoint</div>
              <div className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--glass-border)] rounded-lg px-3 py-2">
                <code className="text-[var(--text-secondary)] text-xs font-mono flex-1 break-all">{bot.webhookUrl}</code>
                <button className="text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors flex-shrink-0">
                  <Copy size={14} />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] text-sm font-medium hover:border-[var(--accent-primary)]/40 hover:text-[var(--text-primary)] transition-all">
                <RefreshCw size={13} />
                {bot.secondaryAction.label}
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold uppercase tracking-wide transition-all hover:opacity-90"
                style={{ background: bot.primaryAction.color, boxShadow: `0 0 15px ${bot.primaryAction.color}30` }}
              >
                <AlertTriangle size={13} />
                {bot.primaryAction.label}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Global Webhook Status Footer */}
      <div className="mt-6 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--success)] animate-pulse" />
          <span className="text-[var(--text-secondary)] text-sm font-medium">
            Global Webhook Relay — <span className="text-[var(--success)] font-bold">Active</span>
          </span>
        </div>
        <div className="flex items-center gap-6 font-mono text-xs text-[var(--text-muted)]">
          <span>Total 24h Messages: <span className="text-[var(--text-primary)] font-bold">2,136</span></span>
          <span>Error Rate: <span className="text-[var(--success)] font-bold">0.0%</span></span>
          <span>Channels: <span className="text-[var(--info)] font-bold">2</span></span>
        </div>
      </div>
    </div>
  );
}
