import React from 'react';
import { AGENTS_DATA } from '@/lib/constants/agents';
import { ShieldAlert } from 'lucide-react';
import dynamic from 'next/dynamic';
import { AgentCommsPanel } from '@/components/war-room/AgentCommsPanel';
import { WarRoomWebSocket } from '@/components/war-room/WarRoomWebSocket';

const WarRoomScene = dynamic(
  () => import('@/components/3d/WarRoomScene').then((mod) => mod.WarRoomScene),
  { ssr: false }
);

export const metadata = {
  title: 'War Room | XXT-AGENT',
  description: 'Mission Critical Agent Overview and Telemetry',
};

export default function WarRoomPage() {
  const onlineAgents = AGENTS_DATA.filter((a) => a.status === 'ONLINE').length;
  const totalAgents = AGENTS_DATA.length;

  return (
    <div className="h-screen w-full bg-[#1a1a1a] font-sans relative overflow-hidden">
      {/* 3D Scene Background */}
      <div className="absolute inset-0 z-0">
        <WarRoomScene />
      </div>

      {/* WebSocket Connection Manager */}
      <WarRoomWebSocket />

      {/* Comms Panel */}
      <AgentCommsPanel />

      {/* 2D HUD / Telemetry UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none p-8 flex flex-col justify-between">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-[#3d3d3d]/50 pb-6 bg-gradient-to-b from-[#1a1a1a]/80 to-transparent p-4 rounded-t-lg backdrop-blur-sm pointer-events-auto">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ShieldAlert className="text-[#D97706]" size={28} />
              <h1 className="text-4xl font-bold text-[#f5f5f5] tracking-tight uppercase drop-shadow-md">
                Agent War Room
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

        {/* Footer HUD elements */}
        <div className="flex justify-between items-end font-mono text-xs text-[#9ca3af]/70 pointer-events-none pb-4">
          <div>
            <p>DRONE FEED: OFFLINE</p>
            <p>SATELLITE UPLINK: ESTABLISHED</p>
          </div>
          <div className="text-right">
            <p>INTERACTIVE MODE: ENABLED</p>
            <p>DRAG TO ROTATE // SCROLL TO ZOOM</p>
          </div>
        </div>
      </div>
    </div>
  );
}
