import React from 'react';

interface LiveIndicatorProps {
    status?: 'ONLINE' | 'OFFLINE' | 'WARNING' | 'SYNCING' | 'STANDBY';
    label?: string;
    className?: string;
}

export function LiveIndicator({ status = 'ONLINE', label = 'LIVE', className = '' }: LiveIndicatorProps) {
    const statusColors: Record<string, string> = {
        ONLINE: 'bg-[#D4AF37]', // gold-primary
        OFFLINE: 'bg-rose-500',
        WARNING: 'bg-amber-500',
        SYNCING: 'bg-sky-400',
        STANDBY: 'bg-slate-400'
    };

    const glowColors: Record<string, string> = {
        ONLINE: 'rgba(212, 175, 55, 0.5)',
        OFFLINE: 'rgba(244, 63, 94, 0.5)',
        WARNING: 'rgba(245, 158, 11, 0.5)',
        SYNCING: 'rgba(56, 189, 248, 0.5)',
        STANDBY: 'rgba(148, 163, 184, 0.5)'
    };

    const colorClass = statusColors[status] || statusColors.ONLINE;
    const glowColor = glowColors[status] || glowColors.ONLINE;

    return (
        <div 
            className={`inline-flex items-center gap-2 font-semibold tracking-widest ${className}`}
            style={{ 
                color: status === 'ONLINE' ? '#D4AF37' : '#fff',
                textShadow: status === 'ONLINE' ? `0 0 10px ${glowColor}` : 'none' 
            }}
        >
            <div className="relative flex h-2 w-2">
                <span 
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorClass}`} 
                    style={{ animationDuration: '2s' }}
                />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${colorClass}`} />
            </div>
            <span className="text-xs uppercase">{label}</span>
        </div>
    );
}
