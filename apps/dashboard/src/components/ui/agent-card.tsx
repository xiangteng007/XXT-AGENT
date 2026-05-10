'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Activity, Zap, Radio, Clock, ChevronRight } from 'lucide-react';
import { AgentData } from '@/lib/constants/agents';

interface AgentCardProps {
  agent: AgentData;
}

const STATUS_CONFIG = {
  ONLINE: { label: '上線', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: Zap },
  OFFLINE: { label: '離線', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: Activity },
  STANDBY: { label: '待命', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', icon: Clock },
  SYNCING: { label: '同步中', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: Radio },
};

export function AgentCard({ agent }: AgentCardProps) {
  const [imgError, setImgError] = useState(false);
  const status = STATUS_CONFIG[agent.status] || STATUS_CONFIG.STANDBY;
  const StatusIcon = status.icon;

  return (
    <div className="agent-card">
      {/* Status Indicator */}
      <div className="agent-card-status" style={{ background: status.bg, color: status.color }}>
        <StatusIcon size={12} />
        <span>{status.label}</span>
      </div>

      {/* Image */}
      <div className="agent-card-image">
        {!imgError ? (
          <Image
            src={agent.imagePath}
            alt={agent.name}
            fill
            className="agent-card-img"
            onError={() => setImgError(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="agent-card-placeholder">
            <span>{agent.name.charAt(0)}</span>
          </div>
        )}
        <div className="agent-card-gradient" />
      </div>

      {/* Info */}
      <div className="agent-card-info">
        <h3 className="agent-card-name">{agent.name}</h3>
        <p className="agent-card-title">{agent.title}</p>
        <p className="agent-card-desc">{agent.description}</p>
      </div>

      {/* Footer */}
      <div className="agent-card-footer">
        <span className="agent-card-version">{agent.version}</span>
        <button className="agent-card-action">
          詳細資訊
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
