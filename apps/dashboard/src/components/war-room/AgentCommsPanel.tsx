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
    <div className="space-y-3 font-mono">
      {hasStatus && (
        <div className="flex items-center gap-2">
          {data.status === 'completed' ? (
            <div className="p-1 rounded-md bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20 shadow-sm">
                <CheckCircle2 size={16} strokeWidth={2} />
            </div>
          ) : (
            <div className="p-1 rounded-md bg-[var(--info)]/10 text-[var(--info)] border border-[var(--info)]/20 shadow-sm animate-pulse">
                <Clock size={16} strokeWidth={2} />
            </div>
          )}
          <span className="uppercase text-[var(--text-primary)] font-semibold tracking-wider">
            STATUS: {String(data.status)}
          </span>
        </div>
      )}

      {hasProgress && (
        <div className="space-y-1">
          <div className="flex justify-between text-[var(--text-secondary)] text-[10px] uppercase font-bold tracking-wider">
            <span>Progress</span>
            <span>{Math.round(data.progress as number)}%</span>
          </div>
          <div className="h-1.5 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-[var(--border-color)]">
            <div 
              className="h-full bg-[var(--success)] transition-all duration-500 ease-in-out relative" 
              style={{ width: `${Math.min(100, Math.max(0, data.progress as number))}%` }}
            >
              <div className="absolute inset-0 bg-white/40 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {hasMetrics && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="bg-[var(--bg-elevated)] p-2 rounded-lg border border-[var(--border-color)] flex flex-col relative overflow-hidden group hover:border-[var(--info)] transition-colors shadow-sm">
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider truncate relative z-10 font-bold">{key.replace(/_/g, ' ')}</span>
              <span className="text-[var(--text-primary)] font-bold relative z-10">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fallback for other data keys */}
      {Object.keys(data).filter(k => !['progress', 'metrics', 'status'].includes(k)).length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
          <span className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider block mb-1">Additional Payload</span>
          <pre className="text-[10px] overflow-x-auto text-[var(--text-primary)] bg-[var(--bg-secondary)] p-2 rounded-lg border border-[var(--border-color)] shadow-inner">
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
    <div className="absolute top-0 right-0 h-full w-full sm:w-[400px] bg-[var(--glass-bg)] backdrop-blur-[16px] border-l border-[var(--border-color)] shadow-2xl flex flex-col z-[var(--z-sidebar)] animate-in slide-in-from-right duration-300 pointer-events-auto relative text-[var(--text-primary)]">
      
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-start bg-[var(--bg-elevated)]/50 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight uppercase" style={{ fontFamily: 'var(--font-outfit, Outfit)' }}>
              {agent.name}
            </h2>
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              agent.status === 'ONLINE' ? 'bg-[var(--success)] shadow-[0_0_8px_var(--success)]' : 
              agent.status === 'OFFLINE' ? 'bg-[var(--danger)] shadow-[0_0_8px_var(--danger)]' : 
              agent.status === 'SYNCING' ? 'bg-[var(--info)] shadow-[0_0_8px_var(--info)]' : 'bg-[var(--warning)] shadow-[0_0_8px_var(--warning)]'
            }`} />
          </div>
          <p className="text-[var(--info)] font-mono text-xs uppercase tracking-widest font-semibold">
            {agent.title} <span className="opacity-50 text-[var(--text-muted)]">{'//'}</span> {agent.version}
          </p>
        </div>
        <button 
          onClick={closeCommsPanel}
          className="text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-all p-2 rounded-xl border border-transparent hover:border-[var(--danger)]/20 shadow-sm backdrop-blur-md"
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      {/* Connection Banner */}
      {!isConnected && (
        <div className="bg-[var(--error)]/10 border-b border-[var(--error)]/30 p-2 text-center text-xs font-mono text-[var(--error)] animate-pulse relative z-10 font-semibold tracking-widest">
          ⚠️ {connectionError || 'UPLINK SEVERED - RECONNECTING...'}
        </div>
      )}

      {/* Vitals / Stats */}
      <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50 font-mono text-xs text-[var(--text-secondary)] relative z-10">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--info)]/10 border border-[var(--info)]/20 shadow-sm text-[var(--info)]">
                <Cpu size={16} strokeWidth={2} />
            </div>
            <span className="tracking-wider">LOAD: <span className="text-[var(--text-primary)] font-bold">{(Math.random() * 40 + 10).toFixed(1)}%</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20 shadow-sm text-[var(--success)]">
                <Activity size={16} strokeWidth={2} />
            </div>
            <span className="tracking-wider">LATENCY: <span className="text-[var(--text-primary)] font-bold">{Math.floor(Math.random() * 50 + 10)}ms</span></span>
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <div className={`p-1.5 rounded-lg border shadow-sm ${isConnected ? "bg-[var(--info)]/10 border-[var(--info)]/20 text-[var(--info)]" : "bg-[var(--danger)]/10 border-[var(--danger)]/20 text-[var(--danger)]"}`}>
                <Network size={16} strokeWidth={2} />
            </div>
            <span className="tracking-wider">UPLINK: <span className="text-[var(--text-primary)] font-bold">{isConnected ? 'SECURE (RSA)' : 'OFFLINE'}</span></span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
          <p className="text-[var(--text-secondary)] font-sans text-sm leading-relaxed font-medium">
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
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-elevated)] relative z-10">
              <h3 className="text-xs font-bold text-[var(--info)] mb-2 uppercase tracking-widest font-mono">ACTIVE TASK DATA</h3>
              <BankingWidget
                actionType={actionType as 'tax_plan' | 'bank_summary' | 'bank_transaction'}
                data={p.data as Parameters<typeof BankingWidget>[0]['data']}
              />
            </div>
          );
        }

        if (selectedAgentId === 'guardian' && actionType) {
          return (
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)] relative z-10">
              <h3 className="text-xs font-bold text-[var(--info)] mb-2 uppercase tracking-widest font-mono">ACTIVE TASK DATA</h3>
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
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)] relative z-10">
              <h3 className="text-xs font-bold text-purple-600 mb-2 uppercase tracking-widest font-mono">INVESTMENT ANALYSIS</h3>
              <InvestmentWidget
                actionType={actionType as 'analysis_result' | 'portfolio_update' | 'signal_alert'}
                data={p.data as Record<string, unknown>}
              />
            </div>
          );
        }

        return (
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-elevated)] relative z-10">
            <h3 className="text-xs font-bold text-[var(--info)] mb-2 uppercase tracking-widest font-mono flex items-center justify-between">
              <span>ACTIVE TASK DATA</span>
              {typeof p.current_step === 'string' && p.current_step && (
                <span className="text-[var(--success)] text-[10px] bg-[var(--success)]/10 px-2 py-0.5 rounded-md border border-[var(--success)]/20 font-semibold tracking-wider shadow-sm">
                  {p.current_step}
                </span>
              )}
            </h3>
            <div className="bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] p-3 text-xs font-mono text-[var(--text-primary)] overflow-x-auto shadow-sm relative group">
              <div className="relative z-10">
                {p.structured_data ? (
                  <TaskDataRenderer data={p.structured_data as Record<string, unknown>} />
                ) : (
                  <span className="text-[var(--text-muted)] italic flex items-center gap-2 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--info)] animate-ping" />
                    PROCESSING STREAM...
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}


      {/* Chat Interface */}
      <div className="flex-1 p-6 overflow-hidden relative z-10">
        <AgentChat agentId={agent.id} />
      </div>
    </div>
  );
}
