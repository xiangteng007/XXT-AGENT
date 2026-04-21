'use client';

import React from 'react';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Shield,
    Target,
    Zap,
    BarChart3,
    AlertTriangle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────

interface Signal {
    type: 'technical' | 'fundamental' | 'sentiment';
    description: string;
    strength: number;
}

interface KeyLevels {
    support: number[];
    resistance: number[];
}

interface InvestmentAnalysis {
    regime: 'bull' | 'bear' | 'range' | 'volatile' | 'unknown';
    trend: 'up' | 'down' | 'range';
    conviction: number;
    signals: Signal[];
    key_levels: KeyLevels;
    catalysts: string[];
    summary: string;
}

interface InvestmentWidgetProps {
    actionType: 'analysis_result' | 'portfolio_update' | 'signal_alert';
    data: InvestmentAnalysis | Record<string, unknown>;
}

// ── Helpers ──────────────────────────────────────────────

const regimeConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    bull: { label: '🐂 牛市', color: '#10b981', bg: '#10b981/15', icon: <TrendingUp size={14} /> },
    bear: { label: '🐻 熊市', color: '#ef4444', bg: '#ef4444/15', icon: <TrendingDown size={14} /> },
    range: { label: '📊 盤整', color: '#f59e0b', bg: '#f59e0b/15', icon: <Minus size={14} /> },
    volatile: { label: '⚡ 劇烈波動', color: '#a855f7', bg: '#a855f7/15', icon: <AlertTriangle size={14} /> },
    unknown: { label: '❓ 未知', color: '#6b7280', bg: '#6b7280/15', icon: <BarChart3 size={14} /> },
};

const signalTypeIcon: Record<string, React.ReactNode> = {
    technical: <BarChart3 size={12} className="text-[#3b82f6]" />,
    fundamental: <Target size={12} className="text-[#10b981]" />,
    sentiment: <Zap size={12} className="text-[#f59e0b]" />,
};

function ConvictionGauge({ value }: { value: number }) {
    const clampedValue = Math.max(0, Math.min(100, value));
    const color =
        clampedValue >= 70 ? '#10b981' :
        clampedValue >= 40 ? '#f59e0b' : '#ef4444';

    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${clampedValue}%`, backgroundColor: color }}
                />
            </div>
            <span className="text-sm font-bold tabular-nums" style={{ color }}>
                {clampedValue}
            </span>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────

export default function InvestmentWidget({ actionType, data }: InvestmentWidgetProps) {
    if (actionType === 'analysis_result') {
        return <AnalysisResult data={data as InvestmentAnalysis} />;
    }

    if (actionType === 'portfolio_update') {
        return <PortfolioUpdate data={data as Record<string, unknown>} />;
    }

    if (actionType === 'signal_alert') {
        return <SignalAlert data={data as Record<string, unknown>} />;
    }

    return (
        <div className="text-[#9ca3af] text-xs italic p-2">
            Unknown investment action: {actionType}
        </div>
    );
}

// ── Sub-Components ───────────────────────────────────────

function AnalysisResult({ data }: { data: InvestmentAnalysis }) {
    const regime = regimeConfig[data.regime] ?? regimeConfig.unknown;

    return (
        <div className="space-y-4">
            {/* Regime + Conviction Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        className="px-2 py-1 rounded-md text-xs font-bold"
                        style={{
                            color: regime.color,
                            backgroundColor: `${regime.color}15`,
                            border: `1px solid ${regime.color}30`,
                        }}
                    >
                        {regime.icon} {regime.label}
                    </span>
                    <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">
                        趨勢: {data.trend === 'up' ? '↑ 上漲' : data.trend === 'down' ? '↓ 下跌' : '→ 盤整'}
                    </span>
                </div>
            </div>

            {/* Conviction Gauge */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider">
                        信心度 Conviction
                    </span>
                    <Shield size={12} className="text-[#6b7280]" />
                </div>
                <ConvictionGauge value={data.conviction} />
            </div>

            {/* Summary */}
            {data.summary && (
                <p className="text-xs text-[#d4d4d8] leading-relaxed bg-[#1a1a1a] p-3 rounded-lg border border-[#3d3d3d]/50">
                    {data.summary}
                </p>
            )}

            {/* Signals */}
            {data.signals && data.signals.length > 0 && (
                <div>
                    <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider block mb-2">
                        訊號 ({data.signals.length})
                    </span>
                    <div className="space-y-1.5">
                        {data.signals.map((sig, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-2 rounded border border-[#3d3d3d]/40"
                            >
                                {signalTypeIcon[sig.type] ?? <Zap size={12} />}
                                <span className="flex-1 text-xs text-[#e5e7eb] truncate">
                                    {sig.description}
                                </span>
                                <span className="text-[10px] font-mono tabular-nums text-[#9ca3af]">
                                    {sig.strength}/100
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Key Levels */}
            {data.key_levels && (
                <div className="grid grid-cols-2 gap-2">
                    {data.key_levels.support.length > 0 && (
                        <div className="bg-[#10b981]/5 border border-[#10b981]/20 rounded p-2">
                            <span className="text-[10px] text-[#10b981] uppercase block mb-1">支撐</span>
                            {data.key_levels.support.map((v, i) => (
                                <span key={i} className="text-xs text-[#e5e7eb] font-mono block">
                                    {typeof v === 'number' ? v.toFixed(2) : String(v)}
                                </span>
                            ))}
                        </div>
                    )}
                    {data.key_levels.resistance.length > 0 && (
                        <div className="bg-[#ef4444]/5 border border-[#ef4444]/20 rounded p-2">
                            <span className="text-[10px] text-[#ef4444] uppercase block mb-1">壓力</span>
                            {data.key_levels.resistance.map((v, i) => (
                                <span key={i} className="text-xs text-[#e5e7eb] font-mono block">
                                    {typeof v === 'number' ? v.toFixed(2) : String(v)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Catalysts */}
            {data.catalysts && data.catalysts.length > 0 && (
                <div>
                    <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider block mb-1.5">
                        催化劑
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {data.catalysts.map((cat, i) => (
                            <span
                                key={i}
                                className="text-[10px] bg-[#D97706]/10 text-[#D97706] px-2 py-0.5 rounded-full border border-[#D97706]/20"
                            >
                                {cat}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function PortfolioUpdate({ data }: { data: Record<string, unknown> }) {
    const totalValue = Number(data.total_value ?? 0);
    const dailyPnl = Number(data.daily_pnl ?? 0);
    const positions = Array.isArray(data.positions) ? data.positions.length : 0;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#1a1a1a] rounded p-2 border border-[#3d3d3d]/50">
                    <span className="text-[10px] text-[#9ca3af] block">總資產</span>
                    <span className="text-sm text-[#e5e7eb] font-mono font-bold">
                        ${totalValue.toLocaleString()}
                    </span>
                </div>
                <div className="bg-[#1a1a1a] rounded p-2 border border-[#3d3d3d]/50">
                    <span className="text-[10px] text-[#9ca3af] block">日損益</span>
                    <span
                        className="text-sm font-mono font-bold"
                        style={{ color: dailyPnl >= 0 ? '#10b981' : '#ef4444' }}
                    >
                        {dailyPnl >= 0 ? '+' : ''}{dailyPnl.toFixed(2)}
                    </span>
                </div>
                <div className="bg-[#1a1a1a] rounded p-2 border border-[#3d3d3d]/50">
                    <span className="text-[10px] text-[#9ca3af] block">持倉數</span>
                    <span className="text-sm text-[#e5e7eb] font-mono font-bold">{positions}</span>
                </div>
            </div>
        </div>
    );
}

function SignalAlert({ data }: { data: Record<string, unknown> }) {
    const direction = String(data.direction ?? 'neutral');
    const symbol = String(data.symbol ?? '');
    const rationale = String(data.rationale ?? '');
    const confidence = Number(data.confidence ?? 0);

    const dirColor =
        direction === 'bullish' ? '#10b981' :
        direction === 'bearish' ? '#ef4444' : '#f59e0b';

    return (
        <div className="bg-[#1a1a1a] border border-[#3d3d3d]/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#e5e7eb]">{symbol}</span>
                <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{
                        color: dirColor,
                        backgroundColor: `${dirColor}15`,
                        border: `1px solid ${dirColor}30`,
                    }}
                >
                    {direction.toUpperCase()}
                </span>
            </div>
            <p className="text-xs text-[#d4d4d8] leading-relaxed">{rationale}</p>
            <ConvictionGauge value={confidence} />
        </div>
    );
}
