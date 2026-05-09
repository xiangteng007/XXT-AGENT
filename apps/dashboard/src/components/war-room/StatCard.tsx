import React from 'react';

// ─── Mini sparkline SVG paths for stat cards ───────────────────────────────
export const SPARKLINES = {
    cpu:    "M0 35 Q 25 10, 50 30 T 100 5",
    memory: "M0 20 Q 30 20, 50 10 T 100 15",
    network:"M0 38 L 20 25 L 40 30 L 60 10 L 80 15 L 100 5",
    jobs:   "M0 30 L 15 20 L 35 28 L 55 12 L 75 22 L 100 8",
};

export function StatCard({
    label,
    value,
    unit,
    sparkline,
    color = 'primary',
    trend,
}: {
    label: string;
    value: string | number;
    unit?: string;
    sparkline?: string;
    color?: 'primary' | 'secondary' | 'tertiary' | 'error';
    trend?: 'up' | 'down' | 'stable';
}) {
    const colorMap = {
        primary:   { text: 'text-[var(--accent-primary)]',  stroke: 'text-[var(--accent-primary)]/40',  bg: 'bg-[var(--accent-primary)]/10',   ring: 'ring-[var(--accent-primary)]/20' },
        secondary: { text: 'text-[var(--success)]', stroke: 'text-[var(--success)]/40', bg: 'bg-[var(--success)]/10', ring: 'ring-[var(--success)]/20' },
        tertiary:  { text: 'text-[var(--danger)]', stroke: 'text-[var(--danger)]/40', bg: 'bg-[var(--danger)]/10', ring: 'ring-[var(--danger)]/20' },
        error:     { text: 'text-[var(--danger)]',    stroke: 'text-[var(--danger)]/40',    bg: 'bg-[var(--danger)]/10',    ring: 'ring-[var(--danger)]/20' },
    };
    const c = colorMap[color];

    const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
    const trendColor = trend === 'up' ? 'text-[var(--success)]' : trend === 'down' ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]';

    return (
        <div className="light-trail-border flex-none w-44 sm:w-52 p-5 rounded-sm bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-transform duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
                {trend && <span className={`text-[10px] font-bold ${trendColor} drop-shadow-[0_0_5px_currentColor]`}>{trendIcon}</span>}
            </div>
            <div className="flex items-baseline gap-1 mt-2">
                <span className={`text-3xl font-mono tracking-tighter ${c.text} drop-shadow-[0_0_8px_currentColor]`}>{value}</span>
                {unit && <span className="text-sm font-medium text-[var(--text-muted)]">{unit}</span>}
            </div>
            {sparkline && (
                <div className="mt-4 h-10 w-full overflow-hidden">
                    <svg className={`w-full h-full ${c.stroke}`} viewBox="0 0 100 40" preserveAspectRatio="none">
                        <path d={sparkline} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </svg>
                </div>
            )}
        </div>
    );
}
