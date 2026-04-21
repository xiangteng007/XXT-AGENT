import React from 'react';
import { AGENTS_DATA } from '@/lib/constants/agents';
import { AgentCard } from '@/components/ui/agent-card';
import { Bot } from 'lucide-react';

export const metadata = {
  title: 'Agents Directory | XXT-AGENT',
  description: 'View and manage all connected AI agents',
};

export default function AgentsPage() {
  const onlineAgents = AGENTS_DATA.filter((a) => a.status === 'ONLINE').length;
  const totalAgents = AGENTS_DATA.length;

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-[#3d3d3d]/50 pb-6 bg-gradient-to-b from-[#1a1a1a]/80 to-transparent p-4 rounded-t-lg backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Bot className="text-[#D97706]" size={28} />
              <h1 className="text-4xl font-bold text-[#f5f5f5] tracking-tight uppercase drop-shadow-md">
                Agents Directory
              </h1>
            </div>
            <p className="text-[#9ca3af] font-mono text-sm uppercase tracking-widest drop-shadow-md">
              System Status: SECURE // Operator ID Verified
            </p>
          </div>

          <div className="mt-4 md:mt-0 flex gap-6 font-mono text-sm bg-[#1a1a1a]/50 p-3 rounded border border-[#3d3d3d]/50 backdrop-blur-md">
            <div className="flex flex-col items-end">
              <span className="text-[#9ca3af]">UPLINK STATUS</span>
              <span className="text-[#10b981] font-bold">
                {onlineAgents} / {totalAgents} ONLINE
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[#9ca3af]">SYSTEM VERSION</span>
              <span className="text-[#D97706] font-bold">v8.0</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {AGENTS_DATA.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
