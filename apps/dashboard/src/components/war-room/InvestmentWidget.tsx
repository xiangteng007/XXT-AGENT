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

const regimeConfig: Record<string, { label: string; colorClass: string; icon: React.ReactNode }> = {
    bull: { label: '🐂 牛市', colorClass: 'text-[var(--success)] bg-[var(--success)]/15 border-[var(--success)]/30', icon: <TrendingUp size={14} /> },
    bear: { label: '🐻 熊市', colorClass: 'text-[var(--danger)] bg-[var(--danger)]/15 border-[var(--danger)]/30', icon: <TrendingDown size={14} /> },
    range: { label: '📊 盤整', colorClass: 'text-[var(--warning)] bg-[var(--warning)]/15 border-[var(--warning)]/30', icon: <Minus size={14} /> },
    volatile: { label: '⚡ 劇烈波動', colorClass: 'text-[#a855f7] bg-[#a855f7]/15 border-[#a855f7]/30', icon: <AlertTriangle size={14} /> },
    unknown: { label: '❓ 未知', colorClass: 'text-[var(--text-muted)] bg-[var(--glass-bg)] border-[var(--glass-border)]', icon: <BarChart3 size={14} /> },
};

const signalTypeIcon: Record<string, React.ReactNode> = {
    technical: <BarChart3 size={12} className="text-[#3b82f6]" />,
    fundamental: <Target size={12} className="text-[var(--success)]" />,
    sentiment: <Zap size={12} className="text-[var(--warning)]" />,
};

function ConvictionGauge({ value }: { value: number }) {
    const clampedValue = Math.max(0, Math.min(100, value));
    const colorVar =
        clampedValue >= 70 ? 'var(--success)' :
        clampedValue >= 40 ? 'var(--warning)' : 'var(--danger)';

    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${clampedValue}%`, backgroundColor: colorVar }}
                />
            </div>
            <span className="text-sm font-bold tabular-nums" style={{ color: colorVar }}>
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
        <div className="text-[var(--text-muted)] text-xs italic p-2">
            未知的投資動作: {actionType}
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
                        className={`px-2 py-1 rounded-md text-xs font-bold border ${regime.colorClass}`}
                    >
                        {regime.icon} {regime.label}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        趨勢: {data.trend === 'up' ? '↑ 上漲' : data.trend === 'down' ? '↓ 下跌' : '→ 盤整'}
                    </span>
                </div>
            </div>

            {/* Conviction Gauge */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        信心度 Conviction
                    </span>
                    <Shield size={12} className="text-[var(--text-muted)]" />
                </div>
                <ConvictionGauge value={data.conviction} />
            </div>

            {/* Summary */}
            {data.summary && (
                <p className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--glass-bg)] p-3 rounded-lg border border-[var(--glass-border)]">
                    {data.summary}
                </p>
            )}

            {/* Signals */}
            {data.signals && data.signals.length > 0 && (
                <div>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-2">
                        訊號 ({data.signals.length})
                    </span>
                    <div className="space-y-1.5">
                        {data.signals.map((sig, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-2 bg-[var(--glass-bg)] px-3 py-2 rounded border border-[var(--glass-border)]"
                            >
                                {signalTypeIcon[sig.type] ?? <Zap size={12} />}
                                <span className="flex-1 text-xs text-[var(--text-primary)] truncate">
                                    {sig.description}
                                </span>
                                <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
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
                        <div className="bg-[var(--success)]/5 border border-[var(--success)]/20 rounded p-2">
                            <span className="text-[10px] text-[var(--success)] uppercase block mb-1">支撐</span>
                            {data.key_levels.support.map((v, i) => (
                                <span key={i} className="text-xs text-[var(--text-primary)] font-mono block">
                                    {typeof v === 'number' ? v.toFixed(2) : String(v)}
                                </span>
                            ))}
                        </div>
                    )}
                    {data.key_levels.resistance.length > 0 && (
                        <div className="bg-[var(--danger)]/5 border border-[var(--danger)]/20 rounded p-2">
                            <span className="text-[10px] text-[var(--danger)] uppercase block mb-1">壓力</span>
                            {data.key_levels.resistance.map((v, i) => (
                                <span key={i} className="text-xs text-[var(--text-primary)] font-mono block">
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
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                        催化劑
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {data.catalysts.map((cat, i) => (
                            <span
                                key={i}
                                className="text-[10px] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] px-2 py-0.5 rounded-full border border-[var(--accent-primary)]/20"
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
                <div className="bg-[var(--glass-bg)] rounded p-2 border border-[var(--glass-border)]">
                    <span className="text-[10px] text-[var(--text-muted)] block">總資產</span>
                    <span className="text-sm text-[var(--text-primary)] font-mono font-bold">
                        ${totalValue.toLocaleString()}
                    </span>
                </div>
                <div className="bg-[var(--glass-bg)] rounded p-2 border border-[var(--glass-border)]">
                    <span className="text-[10px] text-[var(--text-muted)] block">日損益</span>
                    <span
                        className="text-sm font-mono font-bold"
                        style={{ color: dailyPnl >= 0 ? 'var(--success)' : 'var(--danger)' }}
                    >
                        {dailyPnl >= 0 ? '+' : ''}{dailyPnl.toFixed(2)}
                    </span>
                </div>
                <div className="bg-[var(--glass-bg)] rounded p-2 border border-[var(--glass-border)]">
                    <span className="text-[10px] text-[var(--text-muted)] block">持倉數</span>
                    <span className="text-sm text-[var(--text-primary)] font-mono font-bold">{positions}</span>
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

    const dirClass =
        direction === 'bullish' ? 'text-[var(--success)] bg-[var(--success)]/15 border-[var(--success)]/30' :
        direction === 'bearish' ? 'text-[var(--danger)] bg-[var(--danger)]/15 border-[var(--danger)]/30' : 'text-[var(--warning)] bg-[var(--warning)]/15 border-[var(--warning)]/30';

    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">{symbol}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${dirClass}`}>
                    {direction.toUpperCase()}
                </span>
            </div>
            <p className="text-xs text-[var(--text-primary)] opacity-90 leading-relaxed">{rationale}</p>
            <ConvictionGauge value={confidence} />
        </div>
    );
}
