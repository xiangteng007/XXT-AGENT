import React from 'react';

export function AgentBadge({ status }: { status: string }) {
    const isActive = status === 'ONLINE' || status === 'SYNCING';
    const isWarning = status === 'BUSY';

    if (isActive) return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#10b981]/10 rounded-sm border border-[#10b981]/40 backdrop-blur-md shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] beacon-pulse-green" />
            <span className="text-[10px] font-mono font-bold text-[#10b981] uppercase tracking-widest drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]">Active</span>
        </div>
    );
    if (isWarning) return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#D97706]/10 rounded-sm border border-[#D97706]/40 backdrop-blur-md shadow-[0_0_10px_rgba(217,119,6,0.1)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D97706] beacon-pulse-amber" />
            <span className="text-[10px] font-mono font-bold text-[#D97706] uppercase tracking-widest drop-shadow-[0_0_5px_rgba(217,119,6,0.8)]">Busy</span>
        </div>
    );
    return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#1a1a1a]/80 rounded-sm border border-[#3d3d3d] backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6b7280]" />
            <span className="text-[10px] font-mono font-bold text-[#9ca3af] uppercase tracking-widest">Idle</span>
        </div>
    );
}
