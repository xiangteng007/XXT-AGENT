'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Brain, Cpu, MessageSquare, Clock, RefreshCw, Play } from 'lucide-react';

interface DiscussionMessage {
  agent: string;
  content: string;
  round: number;
}

interface AgentState {
  name: string;
  role: string;
  status: string;
  description?: string;
}

// Fallback agents when Gateway offline
const FALLBACK_AGENTS: AgentState[] = [
  { name: 'Argus', role: 'Intel / Radar', status: 'OFFLINE', description: 'Gateway unreachable' },
  { name: 'Titan', role: 'Structural Eng', status: 'OFFLINE', description: 'Gateway unreachable' },
  { name: 'Lumi', role: 'Spatial Design', status: 'OFFLINE', description: 'Gateway unreachable' },
  { name: 'Rusty', role: 'Qty Surveying', status: 'OFFLINE', description: 'Gateway unreachable' },
];

// Showcase thread (static for now — future: WebSocket)
const SHOWCASE_THREAD = [
  { agent: 'Argus', color: '#8B5CF6', time: '14:01 UTC', message: 'ALERT: Chile copper mine strike detected. LME copper price surge signal triggered. Notifying Rusty to pre-position reserves.' },
  { agent: 'Titan', color: 'var(--accent-primary)', time: '14:02 UTC', message: 'Signal received. Structural integrity calculation complete — minimum 4 reinforced pillars required (copper-alloy/steel composite).' },
  { agent: 'Rusty', color: 'var(--info)', time: '14:03 UTC', message: 'Adding 4 pillars will exceed current budget envelope by 12%. Requesting Lumi to evaluate spatial layout reduction.' },
  { agent: 'Lumi', color: 'var(--success)', time: '14:05 UTC', message: 'Received request. Preliminary estimate: 8% floor area reduction recoverable without impacting livability index.' },
];

const statusColorMap: Record<string, string> = {
  MONITORING: '#8B5CF6',
  THINKING: 'var(--accent-primary)',
  PROCESSING: 'var(--accent-primary)',
  IDLE: 'var(--success)',
  AUDITING: 'var(--info)',
  ONLINE: 'var(--success)',
  OFFLINE: 'var(--danger)',
};

export default function AgentMatrixPage() {
  const [agents, setAgents] = useState<AgentState[]>(FALLBACK_AGENTS);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/state');
      if (res.ok) {
        const json = await res.json();
        if (json.live && json.agents) {
          setAgents(json.agents);
          setIsLive(true);
        }
      }
    } catch { /* silent */ }
    finally {
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString('zh-TW'));
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 10_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Discussion state
  const [discussionMessages, setDiscussionMessages] = useState<DiscussionMessage[]>(
    SHOWCASE_THREAD.map((t, i) => ({ agent: t.agent, content: t.message, round: 1 }))
  );
  const [discussionTopic, setDiscussionTopic] = useState('');
  const [discussionRunning, setDiscussionRunning] = useState(false);
  const [discussionConsensus, setDiscussionConsensus] = useState<string | null>(null);
  const [isShowcase, setIsShowcase] = useState(true);

  const startDiscussion = useCallback(async () => {
    if (!discussionTopic.trim() || discussionRunning) return;
    setDiscussionRunning(true);
    setDiscussionMessages([]);
    setDiscussionConsensus(null);
    setIsShowcase(false);

    try {
      const res = await fetch('/api/agents/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: discussionTopic,
          participants: ['argus', 'titan', 'rusty', 'guardian'],
          max_iterations: 2,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setDiscussionMessages(data.messages.map((m: DiscussionMessage) => ({
            agent: m.agent,
            content: m.content,
            round: m.round,
          })));
        }
        if (data.consensus) {
          setDiscussionConsensus(data.consensus);
        }
      }
    } catch { /* silent */ }
    finally { setDiscussionRunning(false); }
  }, [discussionTopic, discussionRunning]);

  return (
    <div className="dashboard-dark min-h-screen w-full bg-[var(--bg-primary)] font-sans text-[var(--text-primary)] p-4 md:p-8 overflow-y-auto">

      {/* Live/Fallback Banner */}
      {!isLive && !loading && (
        <div className="mb-4 px-4 py-2.5 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/5 flex items-center gap-2 text-xs text-[var(--warning)]">
          <span className="font-bold uppercase tracking-widest">⚠️ FALLBACK</span>
          <span className="text-[var(--text-muted)]">Gateway 離線 — 顯示備用狀態。連線後自動切換即時數據。</span>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-[var(--glass-bg)] rounded-xl border border-[var(--accent-primary)]/40 shadow-[0_0_15px_rgba(217,119,6,0.15)]">
              <Brain className="text-[var(--accent-primary)]" size={28} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-outfit, Outfit)' }}>
              A2A Matrix Center
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm md:text-base md:ml-16">
            {isLive ? (
              <>
                <span className="text-[var(--success)] font-bold">LIVE</span>
                {' '}— Updated {lastUpdated} • Auto-refresh 10s
              </>
            ) : 'Cross-agent interrogation & logical inference monitoring'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchState}
            className="flex items-center gap-2 px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-secondary)] text-sm hover:border-[var(--accent-primary)]/40 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <a href="/intelligence" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-[var(--glass-bg)] border border-[var(--info)]/40 rounded-xl text-[var(--info)] text-sm font-bold uppercase tracking-widest hover:border-[var(--info)]/70 transition-all">
            <Cpu size={14} />Open Argus
          </a>
        </div>
      </header>

      {/* Agent Cards */}
      <div className="flex overflow-x-auto gap-4 mb-8 snap-x snap-mandatory pb-2" style={{ scrollbarWidth: 'none' }}>
        {agents.map((agent) => {
          const color = statusColorMap[agent.status] ?? 'var(--text-muted)';
          return (
            <div key={agent.name} className="snap-start min-w-[240px] md:min-w-0 md:flex-1 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl p-5 flex flex-col gap-3 hover:border-[var(--accent-primary)]/30 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[var(--text-primary)] font-bold text-base">{agent.name}</div>
                  <div className="text-[var(--text-muted)] text-xs uppercase tracking-widest">{agent.role}</div>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-widest" style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
                  <div className={`w-1.5 h-1.5 rounded-full ${agent.status === 'IDLE' || agent.status === 'OFFLINE' ? '' : 'animate-pulse'}`} style={{ background: color }} />
                  {agent.status}
                </div>
              </div>
              {agent.description && (
                <p className="text-[var(--text-secondary)] text-xs leading-relaxed">{agent.description}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Discussion Panel — LangGraph State Graph */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-[var(--accent-primary)]" />
            <h2 className="text-sm font-bold uppercase tracking-widest">Multi-Agent Discussion</h2>
          </div>
          <div className="flex items-center gap-2">
            {isShowcase && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/30">
                SHOWCASE
              </span>
            )}
            {!isShowcase && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/30">
                LANGGRAPH
              </span>
            )}
          </div>
        </div>

        {/* Topic Input */}
        <div className="px-6 py-4 border-b border-[var(--glass-border)] flex gap-3">
          <input
            type="text"
            value={discussionTopic}
            onChange={(e) => setDiscussionTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startDiscussion()}
            placeholder="輸入討論議題... (例: 如何在銅價飆漲下維持專案利潤率？)"
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
          />
          <button
            onClick={startDiscussion}
            disabled={discussionRunning || !discussionTopic.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/40 rounded-xl text-[var(--accent-primary)] text-sm font-bold uppercase tracking-widest hover:bg-[var(--accent-primary)]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Play size={14} />
            {discussionRunning ? '討論中...' : '開始討論'}
          </button>
        </div>

        {/* Messages */}
        <div className="p-6">
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: 'linear-gradient(to bottom, var(--accent-primary), transparent)' }} />
            <div className="space-y-5">
              {discussionMessages.map((msg, idx) => {
                const agentColor = statusColorMap[msg.agent.toUpperCase()] ?? 'var(--accent-primary)';
                return (
                  <div key={idx} className="flex gap-5">
                    <div className="relative flex-shrink-0 pt-1">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-primary)]" style={{ background: agentColor, boxShadow: `0 0 10px ${agentColor}` }} />
                    </div>
                    <div className="flex-1 bg-[var(--bg-elevated)] border border-[var(--glass-border)] rounded-xl p-4 hover:border-[var(--accent-primary)]/20 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase tracking-widest" style={{ color: agentColor }}>{msg.agent}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">Round {msg.round}</span>
                      </div>
                      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                );
              })}

              {/* Consensus result */}
              {discussionConsensus && (
                <div className="flex gap-5">
                  <div className="relative flex-shrink-0 pt-1">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-primary)] bg-[var(--success)]" style={{ boxShadow: '0 0 10px var(--success)' }} />
                  </div>
                  <div className="flex-1 bg-[var(--success)]/5 border border-[var(--success)]/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-black uppercase tracking-widest text-[var(--success)]">共識結論</span>
                    </div>
                    <p className="text-[var(--text-primary)] text-sm leading-relaxed font-medium">{discussionConsensus}</p>
                  </div>
                </div>
              )}

              {/* Typing indicator */}
              {discussionRunning && (
                <div className="flex gap-5">
                  <div className="relative flex-shrink-0 pt-1">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-primary)] bg-[var(--text-muted)] animate-pulse" />
                  </div>
                  <div className="flex-1 bg-[var(--bg-elevated)] border border-[var(--glass-border)]/50 rounded-xl p-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--text-muted)] text-xs">Agents deliberating</span>
                      <span className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="w-1 h-1 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

