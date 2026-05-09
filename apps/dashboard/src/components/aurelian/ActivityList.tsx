import React from 'react';
import { GlassPanel } from './GlassPanel';
import { Clock } from 'lucide-react';

export interface ActivityItem {
    id: string;
    title: string;
    timestamp: string;
    source?: string;
    type?: 'info' | 'warn' | 'error' | 'success';
}

interface ActivityListProps {
    title: string;
    items: ActivityItem[];
    className?: string;
}

export function ActivityList({ title, items, className = '' }: ActivityListProps) {
    const getTypeColor = (type?: string) => {
        switch (type) {
            case 'warn': return 'text-amber-400';
            case 'error': return 'text-error';
            case 'success': return 'text-[#00FF41]';
            default: return 'text-[#00FF41]/80';
        }
    };

    return (
        <div className={`bg-[#1c1b1b] p-4 flex flex-col gap-2 border border-[#00FF41]/10 relative ${className}`}>
            <div className="absolute inset-0 bg-[#00FF41]/5 opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex justify-between items-center border-b border-[#00FF41]/20 pb-2 relative z-10">
                <h3 className="font-mono text-xs font-bold text-[#00FF41] uppercase tracking-widest">
                    {title}
                </h3>
                <Clock className="w-4 h-4 text-[#00FF41]" />
            </div>
            
            <div className="font-mono text-[10px] space-y-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
                {items.length === 0 ? (
                    <div className="text-center text-[#00FF41]/30 py-8">
                        &gt; _ NO_ACTIVITY_DETECTED
                    </div>
                ) : (
                    items.map((item) => (
                        <div 
                            key={item.id} 
                            className={`group flex flex-col gap-0.5 p-1 rounded-sm hover:bg-[#00FF41]/10 transition-colors cursor-crosshair ${getTypeColor(item.type)}`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="opacity-50">
                                    &gt; [{new Date(item.timestamp).toLocaleTimeString()}]
                                </span>
                                {item.source && (
                                    <span className="opacity-70 border border-current px-1 text-[8px]">
                                        {item.source}
                                    </span>
                                )}
                            </div>
                            <p className="leading-tight break-all">
                                {item.title}
                            </p>
                        </div>
                    ))
                )}
                <p className="text-[#00FF41] animate-pulse">&gt; _</p>
            </div>
            
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0, 255, 65, 0.05);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 255, 65, 0.3);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 255, 65, 0.6);
                }
            `}</style>
        </div>
    );
}
