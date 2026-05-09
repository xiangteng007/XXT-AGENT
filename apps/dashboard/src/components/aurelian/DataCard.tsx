import React from 'react';
import { GlassPanel } from './GlassPanel';

interface DataCardProps {
    title: string;
    value: string | number;
    trend?: {
        value: number | string;
        label?: string;
        isPositive?: boolean;
    };
    icon?: React.ReactNode;
    className?: string;
}

export function DataCard({ title, value, trend, icon, className = '' }: DataCardProps) {
    return (
        <div className={`bg-[#1c1b1b] p-3 border-l-4 border-[#00FF41] flex justify-between items-end relative overflow-hidden group ${className}`}>
            {/* Scanline & subtle hover effect */}
            <div className="absolute inset-0 bg-[#00FF41]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            <div>
                <div className="flex items-center gap-2 mb-1">
                    {icon && (
                        <div className="text-[#00FF41]/60 w-3 h-3 flex items-center justify-center">
                            {icon}
                        </div>
                    )}
                    <p className="font-mono text-[10px] text-[#00FF41]/60 leading-none uppercase tracking-wider">
                        {title}
                    </p>
                </div>
                <p className="font-sans text-2xl font-bold text-[#00FF41] glow-sm tracking-tighter">
                    {value}
                </p>
            </div>

            {trend && (
                <div className="text-right flex flex-col items-end">
                    <p className="font-mono text-[10px] text-[#00FF41]/60 leading-none mb-1 uppercase">
                        {trend.label || 'TREND'}
                    </p>
                    <div className="flex items-center gap-1">
                        <span 
                            className={`font-mono text-xs font-bold ${
                                trend.isPositive === undefined 
                                    ? 'text-[#00FF41]/70' 
                                    : trend.isPositive 
                                        ? 'text-[#00FF41]' 
                                        : 'text-error'
                            }`}
                        >
                            {trend.isPositive ? '+' : ''}{trend.value}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
