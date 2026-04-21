'use client';

import React from 'react';
import { useWarRoomStore, type AgentTaskPayload } from '@/lib/store/warRoomStore';
import { AGENTS_DATA } from '@/lib/constants/agents';
import { X, Activity, Cpu, Network, CheckCircle2, Clock } from 'lucide-react';
import { AgentChat } from './AgentChat';
import { BankingWidget } from './BankingWidget';
import { GuardianWidget } from './GuardianWidget';
import InvestmentWidget from './InvestmentWidget';

// Helper component to render different types of structured task data
function TaskDataRenderer({ data }: { data: Record<string, unknown> }) {
  if (!data || typeof data !== 'object') return null;

  const hasProgress = typeof data.progress === 'number';
  const hasMetrics  = data.metrics != null && typeof data.metrics === 'object';
  const hasStatus   = typeof data.status === 'string';
  const metrics     = hasMetrics ? (data.metrics as Record<string, unknown>) : {};

  return (
    <div className="space-y-3">
      {hasStatus && (
        <div className="flex items-center gap-2">
          {data.status === 'completed' ? (
            <CheckCircle2 size={14} className="text-[#10b981]" />
          ) : (
            <Clock size={14} className="text-[#3b82f6] animate-pulse" />
          )}
          <span className="uppercase text-[#e5e7eb] font-semibold">
            STATUS: {String(data.status)}
          </span>
        </div>
      )}

      {hasProgress && (
        <div className="space-y-1">
          <div className="flex justify-between text-[#9ca3af] text-[10px] uppercase">
            <span>Progress</span>
            <span>{Math.round(data.progress as number)}%</span>
          </div>
          <div className="h-1.5 w-full bg-[#3d3d3d] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#10b981] transition-all duration-500 ease-in-out" 
              style={{ width: `${Math.min(100, Math.max(0, data.progress as number))}%` }}
            />
          </div>
        </div>
      )}

      {hasMetrics && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="bg-[#2a2a2a] p-2 rounded border border-[#3d3d3d]/50 flex flex-col">
              <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider truncate">{key.replace(/_/g, ' ')}</span>
              <span className="text-[#e5e7eb] font-medium">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fallback for other data keys */}
      {Object.keys(data).filter(k => !['progress', 'metrics', 'status'].includes(k)).length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#3d3d3d]/50">
          <span className="text-[#9ca3af] text-[10px] uppercase block mb-1">Additional Payload</span>
          <pre className="text-[10px] overflow-x-auto text-[#d4d4d8]">
            {JSON.stringify(
              Object.fromEntries(Object.entries(data).filter(([k]) => !['progress', 'metrics', 'status'].includes(k))),
              null, 2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

export function AgentCommsPanel() {
  const { 
    isCommsPanelOpen, 
    selectedAgentId, 
    closeCommsPanel,
    isConnected,
    connectionError,
    agentTaskPayloads
  } = useWarRoomStore();

  if (!isCommsPanelOpen || !selectedAgentId) return null;

  const agent = AGENTS_DATA.find((a) => a.id === selectedAgentId);
  const taskPayload = agentTaskPayloads[selectedAgentId];
  
  if (!agent) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-[400px] bg-[#1a1a1a]/95 backdrop-blur-xl border-l border-[#3d3d3d] shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-300 pointer-events-auto">
      {/* Header */}
      <div className="p-6 border-b border-[#3d3d3d]/50 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-[#f5f5f5] tracking-tight uppercase">
              {agent.name}
            </h2>
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              agent.status === 'ONLINE' ? 'bg-[#10b981]' : 
              agent.status === 'OFFLINE' ? 'bg-[#ef4444]' : 
              agent.status === 'SYNCING' ? 'bg-[#3b82f6]' : 'bg-[#f59e0b]'
            }`} />
          </div>
          <p className="text-[#D97706] font-mono text-xs uppercase tracking-widest">
            {agent.title} {'//'} {agent.version}
          </p>
        </div>
        <button 
          onClick={closeCommsPanel}
          className="text-[#9ca3af] hover:text-[#f5f5f5] transition-colors p-1"
        >
          <X size={20} />
        </button>
      </div>

      {/* Connection Banner */}
      {!isConnected && (
        <div className="bg-[#ef4444]/20 border-b border-[#ef4444]/50 p-2 text-center text-xs font-mono text-[#ef4444] animate-pulse">
          ⚠️ {connectionError || 'UPLINK SEVERED - RECONNECTING...'}
        </div>
      )}

      {/* Vitals / Stats */}
      <div className="p-6 border-b border-[#3d3d3d]/50 bg-[#121212]/50 font-mono text-xs text-[#9ca3af]">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-[#3b82f6]" />
            <span>NEURAL LOAD: {(Math.random() * 40 + 10).toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[#10b981]" />
            <span>LATENCY: {Math.floor(Math.random() * 50 + 10)}ms</span>
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <Network size={14} className={isConnected ? "text-[#8b5cf6]" : "text-[#ef4444]"} />
            <span>UPLINK: {isConnected ? 'SECURE (RSA-4096)' : 'OFFLINE'}</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[#3d3d3d]/50">
          <p className="text-[#e5e7eb] font-sans text-sm leading-relaxed">
            {agent.description}
          </p>
        </div>
      </div>

      {/* Task View Widget — specialist or generic */}
      {taskPayload && (() => {
        const p = taskPayload as Record<string, unknown>;
        const actionType = p.action_type as string | undefined;

        if ((selectedAgentId === 'accountant' || selectedAgentId === 'kay') && actionType) {
          return (
            <div className="p-4 border-b border-[#3d3d3d]/50 bg-[#0a0a0a]">
              <h3 className="text-xs font-bold text-[#D97706] mb-2 uppercase tracking-wider">ACTIVE TASK DATA</h3>
              <BankingWidget
                actionType={actionType as 'tax_plan' | 'bank_summary' | 'bank_transaction'}
                data={p.data as Parameters<typeof BankingWidget>[0]['data']}
              />
            </div>
          );
        }

        if (selectedAgentId === 'guardian' && actionType) {
          return (
            <div className="p-4 border-b border-[#3d3d3d]/50 bg-[#0a0a0a]">
              <h3 className="text-xs font-bold text-[#0ea5e9] mb-2 uppercase tracking-wider">ACTIVE TASK DATA</h3>
              <GuardianWidget
                actionType={actionType as 'policy_summary' | 'booking_status' | 'coverage_check'}
                data={p.data as Parameters<typeof GuardianWidget>[0]['data']}
              />
            </div>
          );
        }

        // Investment Brain → InvestmentWidget
        if (
            (selectedAgentId === 'nova-invest' ||
             selectedAgentId === 'investment-brain' ||
             selectedAgentId === 'nova') &&
            actionType
        ) {
          return (
            <div className="p-4 border-b border-[#3d3d3d]/50 bg-[#0a0a0a]">
              <h3 className="text-xs font-bold text-[#a855f7] mb-2 uppercase tracking-wider">INVESTMENT ANALYSIS</h3>
              <InvestmentWidget
                actionType={actionType as 'analysis_result' | 'portfolio_update' | 'signal_alert'}
                data={p.data as Record<string, unknown>}
              />
            </div>
          );
        }

        return (
          <div className="p-4 border-b border-[#3d3d3d]/50 bg-[#0a0a0a]">
            <h3 className="text-xs font-bold text-[#D97706] mb-2 uppercase tracking-wider flex items-center justify-between">
              <span>ACTIVE TASK DATA</span>
              {typeof p.current_step === 'string' && p.current_step && (
                <span className="text-[#10b981] text-[10px] bg-[#10b981]/10 px-2 py-0.5 rounded-full border border-[#10b981]/30">
                  {p.current_step}
                </span>
              )}
            </h3>
            <div className="bg-[#1a1a1a] rounded border border-[#3d3d3d] p-3 text-xs font-mono text-[#e5e7eb] overflow-x-auto shadow-inner">
              {p.structured_data ? (
                <TaskDataRenderer data={p.structured_data as Record<string, unknown>} />
              ) : (
                <span className="text-[#9ca3af] italic flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9ca3af] animate-ping" />
                  Processing stream...
                </span>
              )}
            </div>
          </div>
        );
      })()}


      {/* Chat Interface */}
      <div className="flex-1 p-6 overflow-hidden">
        <AgentChat agentId={agent.id} />
      </div>
    </div>
  );
}
