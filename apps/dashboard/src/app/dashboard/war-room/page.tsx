'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AGENTS_DATA } from '@/lib/constants/agents';
import { ShieldCheck, Activity, Users } from 'lucide-react';
import { AgentCommsPanel } from '@/components/war-room/AgentCommsPanel';
import { WarRoomWebSocket } from '@/components/war-room/WarRoomWebSocket';
import { HRWidget } from '@/components/war-room/HRWidget';
import { MaterialCalculatorWidget } from '@/components/war-room/MaterialCalculatorWidget';
import InvestmentWidget from '@/components/war-room/InvestmentWidget';
import { BankingWidget } from '@/components/war-room/BankingWidget';
import { GuardianWidget } from '@/components/war-room/GuardianWidget';
import { StatCard, SPARKLINES } from '@/components/war-room/StatCard';
import { useWarRoomStore } from '@/lib/store/warRoomStore';
import Image from 'next/image';

export default function WarRoomPage() {
  // Live agent state with fallback to constants
  const [liveAgents, setLiveAgents] = useState(AGENTS_DATA);
  const [isLive, setIsLive] = useState(false);

  const fetchAgentState = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/state');
      if (res.ok) {
        const json = await res.json();
        if (json.live && json.agents) {
          setLiveAgents(json.agents);
          setIsLive(true);
          return;
        }
      }
    } catch { /* silent */ }
    setLiveAgents(AGENTS_DATA);
    setIsLive(false);
  }, []);

  useEffect(() => {
    fetchAgentState();
    const interval = setInterval(fetchAgentState, 10_000);
    return () => clearInterval(interval);
  }, [fetchAgentState]);

  const onlineAgents = liveAgents.filter((a: { status: string }) => a.status === 'ONLINE').length;
  const totalAgents = liveAgents.length;
  
  const { openCommsPanel, selectedAgentId } = useWarRoomStore();

  return (
    <div className="min-h-screen w-full bg-[var(--bg-primary)] font-sans text-[var(--text-primary)] p-4 md:p-8 overflow-y-auto">
      {/* WebSocket Connection Manager */}
      <WarRoomWebSocket />

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 md:gap-0">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-[var(--violet-glow)] rounded-xl border border-[var(--violet-primary)] shadow-[0_0_15px_rgba(139,92,246,0.2)]">
              <ShieldCheck className="text-[var(--violet-primary)]" size={32} strokeWidth={2} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-outfit, Outfit)' }}>
              戰術指揮中心
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] font-medium text-sm md:text-base tracking-wide md:ml-16">
            系統狀態: <span className="text-[var(--success)] font-semibold shadow-sm">安全 (SECURE)</span> &bull; 操作員身分已驗證
          </p>
        </div>

        <div className="flex items-center gap-4 md:gap-6 font-medium text-sm bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] px-5 py-3 rounded-2xl border border-[var(--glass-border)] shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--success)]/10 flex items-center justify-center border border-[var(--success)]/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
              <Activity className="text-[var(--success)]" size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[var(--text-muted)] text-xs tracking-widest uppercase font-bold">連線狀態</span>
              <span className="text-[var(--text-primary)] font-bold text-base">
                {onlineAgents} / {totalAgents} 上線
              </span>
            </div>
          </div>
          <div className="w-px h-10 bg-[var(--border-color)] mx-1"></div>
          <div className="flex flex-col">
            <span className="text-[var(--text-muted)] text-xs tracking-widest uppercase font-bold">系統版本</span>
            <span className="text-[var(--info)] font-bold text-base">v2.5.0{isLive ? ' (LIVE)' : ''}</span>
          </div>
        </div>
      </header>

      {/* Telemetry StatCards (Horizontal Scroll on Mobile) */}
      <div className="flex overflow-x-auto gap-4 mb-8 snap-x snap-mandatory scrollbar-hide pb-2">
        <div className="snap-start min-w-[260px] md:min-w-0 md:flex-1">
          <StatCard 
            label="CORE PROCESSOR" 
            value="89%" 
            sparkline={SPARKLINES.cpu} 
            unit="GHz" 
            color="tertiary"
            trend="up"
          />
        </div>
        <div className="snap-start min-w-[260px] md:min-w-0 md:flex-1">
          <StatCard 
            label="NEURAL MEMORY" 
            value="32.4" 
            sparkline={SPARKLINES.memory} 
            unit="GB" 
            color="secondary"
            trend="stable"
          />
        </div>
        <div className="snap-start min-w-[260px] md:min-w-0 md:flex-1">
          <StatCard 
            label="NETWORK UPLINK" 
            value="1.2" 
            sparkline={SPARKLINES.network} 
            unit="Gbps" 
            color="primary"
            trend="up"
          />
        </div>
        <div className="snap-start min-w-[260px] md:min-w-0 md:flex-1">
          <StatCard 
            label="SYSTEM SEC" 
            value="100%" 
            sparkline={SPARKLINES.jobs} 
            unit="OK" 
            color="secondary"
            trend="stable"
          />
        </div>
      </div>

      {/* Main 2D Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        {/* Left Column: Agents Grid & Operations */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Agent Roster */}
          <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] rounded-2xl border border-[var(--glass-border)] shadow-lg overflow-hidden p-6">
            <div className="flex items-center gap-2 mb-4 text-[var(--text-primary)]">
              <Users size={20} className="text-[var(--info)]" />
              <h2 className="text-lg font-bold uppercase tracking-wider">特務編制 (Agent Roster)</h2>
            </div>
            <div className="grid grid-flow-col auto-cols-[85%] sm:auto-cols-[45%] md:grid-flow-row md:grid-cols-3 gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide">
              {AGENTS_DATA.map(agent => (
                <button 
                  key={agent.id}
                  onClick={() => openCommsPanel(agent.id)}
                  className={`snap-center flex flex-col items-center p-4 rounded-xl border transition-all duration-300 ${
                    selectedAgentId === agent.id 
                      ? 'bg-[var(--primary)]/10 border-[var(--primary)] shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]' 
                      : 'bg-[var(--bg-elevated)] border-[var(--border-color)] hover:border-[var(--primary)]/50 hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl overflow-hidden mb-3 border-2 border-[var(--border-color)] shadow-sm">
                    {agent.imagePath ? (
                      <Image src={agent.imagePath} alt={agent.name} width={64} height={64} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)] text-xl font-bold">
                        {agent.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-[var(--text-primary)] tracking-wide">{agent.name}</h3>
                  <span className="text-xs text-[var(--text-secondary)] mb-2 uppercase text-center truncate w-full">{agent.title}</span>
                  
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase border ${
                    agent.status === 'ONLINE' ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30' :
                    agent.status === 'STANDBY' ? 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/30' :
                    agent.status === 'SYNCING' ? 'bg-[var(--info)]/10 text-[var(--info)] border-[var(--info)]/30' :
                    'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-color)]'
                  }`}>
                    {agent.status}
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Investment & Market Intel */}
          <InvestmentWidget 
            actionType="analysis_result" 
            data={{
              regime: 'bull',
              trend: 'up',
              conviction: 88,
              signals: [
                { type: 'technical', description: 'MACD 黃金交叉 / 均線多頭排列', strength: 85 },
                { type: 'sentiment', description: '市場資金流入 AI 供應鏈', strength: 92 },
                { type: 'fundamental', description: 'Q3 營收預期超標', strength: 78 }
              ],
              key_levels: {
                support: [21500, 21200],
                resistance: [22000, 22500]
              },
              catalysts: ['先進封裝產能擴充', '法說會正向展望'],
              summary: '晶片核心供應鏈呈現強勢多頭格局，建議在支撐位附近建立部位，並密切關注下週財報發布。'
            }} 
          />
        </div>

        {/* Right Column: Calculations & HR */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <HRWidget 
            calculationType="salary" 
            data={{
              baseSalary: 125000,
              overtimePay: 18500,
              laborInsurance: 2400,
              healthInsurance: 1800,
              pension: 7500,
              netPay: 131800
            }} 
          />
          <MaterialCalculatorWidget 
            calculationType="scaffolding" 
            data={{
              verticalArea: 2450.5,
              rentalCost: 73500,
              installationCost: 45000,
              safetyNetCost: 12500,
              totalCost: 131000
            }} 
          />
          <BankingWidget 
            actionType="bank_transaction" 
            data={{
              type: 'income',
              amount: 250000,
              currency: 'NTD',
              date: '2026-05-01',
              category: '工程款',
              entity: 'XXT',
              description: '第2期工程款入帳',
              entry_id: 'TX-202605-001'
            }} 
          />
          <GuardianWidget 
            actionType="policy_summary" 
            data={{
              policy_id: 'POL-992-11A',
              policy_name: '工程營造綜合保險',
              insurer: '富邦產險',
              status: 'active',
              ledger_linked: true,
              annual_premium: 150000,
              currency: 'NTD',
              coverage_start: '2026-01-01',
              coverage_end: '2026-12-31'
            }} 
          />
          
          {/* Telemetry Footer Widgets */}
          <div className="grid grid-cols-1 gap-4 mt-auto">
            <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] px-5 py-4 rounded-xl border border-[var(--glass-border)] shadow-sm flex justify-between items-center text-sm font-medium">
              <span className="text-[var(--text-secondary)]">衛星連線</span>
              <span className="text-[var(--success)] font-bold drop-shadow-sm">已建立 (ESTABLISHED)</span>
            </div>
            <div className="bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] px-5 py-4 rounded-xl border border-[var(--glass-border)] shadow-sm flex justify-between items-center text-sm font-medium">
              <span className="text-[var(--text-secondary)]">邊緣推論引擎</span>
              <span className="text-[var(--info)] font-bold drop-shadow-sm">在線 (ONLINE)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Comms Panel Overlay */}
      <AgentCommsPanel />
    </div>
  );
}
