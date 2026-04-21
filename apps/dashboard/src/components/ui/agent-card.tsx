import React from 'react';
import Image from 'next/image';
import { ShieldAlert, Activity, Wifi } from 'lucide-react';
import { AgentData } from '@/lib/constants/agents';

interface AgentCardProps {
  agent: AgentData;
}

export function AgentCard({ agent }: AgentCardProps) {
  // Status Color Mapping based on Carbon Copper V5
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'text-[#10b981]'; // Emerald
      case 'OFFLINE':
        return 'text-[#e11d48]'; // Rose/Red
      case 'STANDBY':
        return 'text-[#9ca3af]'; // Gray
      case 'SYNCING':
        return 'text-[#D97706]'; // Copper/Amber
      default:
        return 'text-[#9ca3af]';
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg bg-[#2d2d2d] bg-opacity-80 backdrop-blur-sm border border-[#3d3d3d] shadow-lg flex flex-col transition-transform hover:scale-[1.02] duration-300">
      {/* Telemetry Header */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-[#1a1a1a] bg-[#1a1a1a]/50">
        <div className="flex items-center gap-2">
          <Activity size={14} className={getStatusColor(agent.status)} />
          <span className="text-xs font-mono text-[#f5f5f5] uppercase tracking-wider">
            {agent.id} {'//'} {agent.status}
          </span>
        </div>
        <span className="text-[10px] font-mono text-[#D97706]">
          {agent.version}
        </span>
      </div>

      {/* Image Container */}
      <div className="relative w-full h-80 bg-[#1a1a1a]">
        {/* We use next/image. The images are tall 3D turnarounds, so object-contain is best */}
        <Image
          src={agent.imagePath}
          alt={`${agent.name} 3D Turnaround`}
          fill
          className="object-contain"
          priority
        />
        {/* Gradient overlay for blending */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#2d2d2d] via-transparent to-transparent opacity-90" />
      </div>

      {/* Agent Info */}
      <div className="p-5 flex flex-col flex-grow z-10 -mt-8">
        <h3 className="text-2xl font-bold text-[#f5f5f5] tracking-wide mb-1">
          {agent.name}
        </h3>
        <p className="text-sm text-[#D97706] font-medium mb-3">
          {agent.title}
        </p>
        <p className="text-sm text-[#9ca3af] leading-relaxed flex-grow">
          {agent.description}
        </p>

        {/* Action Button */}
        <button className="mt-5 w-full flex items-center justify-center gap-2 bg-[#D97706] hover:bg-[#b46305] text-[#1a1a1a] font-bold py-2.5 px-4 rounded transition-colors uppercase tracking-widest text-sm">
          <Wifi size={16} />
          Initiate Uplink
        </button>
      </div>
    </div>
  );
}
