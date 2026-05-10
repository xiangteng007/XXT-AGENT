import React from 'react';
import { AGENTS_DATA } from '@/lib/constants/agents';
import { AgentCard } from '@/components/ui/agent-card';
import { Bot, Zap, Shield } from 'lucide-react';

export const metadata = {
  title: 'Agents Directory | XXT',
  description: '查看並管理所有 AI 代理人',
};

export default function AgentsPage() {
  const onlineAgents = AGENTS_DATA.filter((a) => a.status === 'ONLINE').length;
  const standbyAgents = AGENTS_DATA.filter((a) => a.status === 'STANDBY').length;
  const totalAgents = AGENTS_DATA.length;

  return (
    <div className="agents-directory">
      {/* Hero Header */}
      <header className="agents-header">
        <div className="agents-header-content">
          <div className="agents-header-icon">
            <Bot size={28} />
          </div>
          <div>
            <h1 className="agents-title">AI 代理人目錄</h1>
            <p className="agents-subtitle">
              XXT 智慧代理人生態系 — {totalAgents} 位專業 AI 代理人
            </p>
          </div>
        </div>

        <div className="agents-stats">
          <div className="agents-stat">
            <Zap size={16} className="agents-stat-icon online" />
            <div>
              <span className="agents-stat-value">{onlineAgents}</span>
              <span className="agents-stat-label">上線中</span>
            </div>
          </div>
          <div className="agents-stat">
            <Shield size={16} className="agents-stat-icon standby" />
            <div>
              <span className="agents-stat-value">{standbyAgents}</span>
              <span className="agents-stat-label">待命中</span>
            </div>
          </div>
          <div className="agents-stat">
            <Bot size={16} className="agents-stat-icon total" />
            <div>
              <span className="agents-stat-value">{totalAgents}</span>
              <span className="agents-stat-label">總數</span>
            </div>
          </div>
        </div>
      </header>

      {/* Core Team Section */}
      <section className="agents-section">
        <h2 className="agents-section-title">
          <span className="agents-section-dot core" />
          核心團隊
        </h2>
        <div className="agents-grid">
          {AGENTS_DATA.filter(a => ['argus', 'nova', 'rusty', 'lumi', 'titan'].includes(a.id)).map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </section>

      {/* UAV Division */}
      <section className="agents-section">
        <h2 className="agents-section-title">
          <span className="agents-section-dot uav" />
          無人機事業部
        </h2>
        <div className="agents-grid">
          {AGENTS_DATA.filter(a => ['hardware-innovator', 'firmware-engineer', 'forge', 'matter', 'evolution-researcher', 'qa-engineer', 'rf-engineer', 'hmi-designer', 'power-engineer'].includes(a.id)).map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </section>
    </div>
  );
}
