import React from 'react';

export interface ActivityItem {
    id: string;
    title: string;
    timestamp: string;
    source: string;
    type: 'info' | 'warn' | 'error';
}

export function LogItem({ log }: { log: ActivityItem }) {
    const isError = log.type === 'error';
    const isWarn  = log.type === 'warn';
    const colorClass = isError ? 'text-rose-500' : isWarn ? 'text-[#D97706]' : 'text-[#10b981]';
    const borderClass = isError ? 'border-rose-500/50' : isWarn ? 'border-[#D97706]/50' : 'border-[#10b981]/50';
    const bgClass = isError ? 'bg-rose-500/10' : isWarn ? 'bg-[#D97706]/10' : 'bg-[#10b981]/5';

    return (
        <div className={`p-2 border-l-2 ${borderClass} ${bgClass} hover:bg-opacity-20 transition-colors font-mono text-[11px] leading-relaxed mb-1.5 flex flex-col gap-1 rounded-r-sm`}>
            <div className="flex justify-between items-start gap-3">
                <span className={`${colorClass} opacity-80 shrink-0`}>[{log.timestamp.substring(11, 19)}]</span>
                <span className={`font-semibold ${colorClass} shrink-0 drop-shadow-[0_0_3px_currentColor]`}>[{log.source}]</span>
                <p className={`${colorClass} flex-1 break-all opacity-90`}>{log.title}</p>
            </div>
        </div>
    );
}
