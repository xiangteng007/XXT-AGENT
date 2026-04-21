'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';

// ── Types ────────────────────────────────────────────────

interface Position {
    symbol: string;
    name?: string;
    shares: number;
    avg_cost: number;
    current_price: number;
    market_value: number;
    unrealized_pnl: number;
    unrealized_pnl_pct: number;
}

interface Portfolio {
    total_value: number;
    cash: number;
    positions: Position[];
    daily_pnl: number;
    total_pnl: number;
    total_pnl_pct: number;
}

// ── Component ────────────────────────────────────────────

export default function PortfolioPage() {
    const { getIdToken } = useAuth();
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);

    const fetchPortfolio = useCallback(async () => {
        try {
            const token = await getIdToken();
            const res = await fetch('/api/market/portfolio', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setPortfolio(data.portfolio ?? data);
            }
        } catch (err) {
            console.error('Portfolio fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, [getIdToken]);

    useEffect(() => {
        fetchPortfolio();
    }, [fetchPortfolio]);

    const triggerAnalysis = async () => {
        setAnalyzing(true);
        try {
            const token = await getIdToken();
            await fetch('/api/market/portfolio', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'full_analysis' }),
            });
        } catch (err) {
            console.error('Analysis failed:', err);
        } finally {
            setAnalyzing(false);
        }
    };

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const pnlColor = (v: number) => (v >= 0 ? '#10b981' : '#ef4444');

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>📊</div>
                載入投資組合中...
            </div>
        );
    }

    if (!portfolio) {
        return (
            <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>
                無法載入投資組合資料
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '24px',
            }}>
                <h1 style={{ fontSize: '24px', fontWeight: 600 }}>💼 投資組合</h1>
                <button
                    onClick={triggerAnalysis}
                    disabled={analyzing}
                    style={{
                        padding: '8px 20px',
                        background: analyzing ? 'var(--bg-tertiary)' : '#D97706',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: analyzing ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                    }}
                >
                    {analyzing ? '分析中...' : '🤖 AI 分析'}
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px',
                marginBottom: '24px',
            }}>
                {/* Total Value */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '20px',
                }}>
                    <div style={{
                        fontSize: '11px', color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '1px',
                        marginBottom: '8px',
                    }}>
                        總資產
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(portfolio.total_value)}
                    </div>
                </div>

                {/* Cash */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '20px',
                }}>
                    <div style={{
                        fontSize: '11px', color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '1px',
                        marginBottom: '8px',
                    }}>
                        現金
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>
                        {formatCurrency(portfolio.cash)}
                    </div>
                </div>

                {/* Daily P&L */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '20px',
                }}>
                    <div style={{
                        fontSize: '11px', color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '1px',
                        marginBottom: '8px',
                    }}>
                        日損益
                    </div>
                    <div style={{
                        fontSize: '24px', fontWeight: 700,
                        color: pnlColor(portfolio.daily_pnl),
                    }}>
                        {portfolio.daily_pnl >= 0 ? '+' : ''}{formatCurrency(portfolio.daily_pnl)}
                    </div>
                </div>

                {/* Total P&L */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '20px',
                }}>
                    <div style={{
                        fontSize: '11px', color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '1px',
                        marginBottom: '8px',
                    }}>
                        總損益
                    </div>
                    <div style={{
                        fontSize: '24px', fontWeight: 700,
                        color: pnlColor(portfolio.total_pnl),
                    }}>
                        {portfolio.total_pnl >= 0 ? '+' : ''}{formatCurrency(portfolio.total_pnl)}
                        <span style={{ fontSize: '13px', marginLeft: '6px' }}>
                            ({portfolio.total_pnl_pct >= 0 ? '+' : ''}
                            {(portfolio.total_pnl_pct * 100).toFixed(2)}%)
                        </span>
                    </div>
                </div>
            </div>

            {/* Positions Table */}
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                overflow: 'hidden',
            }}>
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 600 }}>
                        持倉明細 ({portfolio.positions.length})
                    </h2>
                </div>

                {portfolio.positions.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '48px', color: 'var(--text-muted)',
                    }}>
                        尚無持倉 — 請透過 Investment Brain 執行交易策略
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{
                                borderBottom: '1px solid var(--border-color)',
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                color: 'var(--text-muted)',
                            }}>
                                <th style={{ textAlign: 'left', padding: '12px 20px' }}>標的</th>
                                <th style={{ textAlign: 'right', padding: '12px 16px' }}>股數</th>
                                <th style={{ textAlign: 'right', padding: '12px 16px' }}>均價</th>
                                <th style={{ textAlign: 'right', padding: '12px 16px' }}>現價</th>
                                <th style={{ textAlign: 'right', padding: '12px 16px' }}>市值</th>
                                <th style={{ textAlign: 'right', padding: '12px 20px' }}>未實現損益</th>
                            </tr>
                        </thead>
                        <tbody>
                            {portfolio.positions.map(pos => (
                                <tr
                                    key={pos.symbol}
                                    style={{
                                        borderBottom: '1px solid var(--border-color)',
                                        transition: 'background 0.15s ease',
                                    }}
                                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <td style={{ padding: '14px 20px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                            {pos.symbol}
                                        </div>
                                        {pos.name && (
                                            <div style={{
                                                fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px',
                                            }}>
                                                {pos.name}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{
                                        textAlign: 'right', padding: '14px 16px',
                                        fontFamily: 'monospace', fontSize: '13px',
                                    }}>
                                        {pos.shares}
                                    </td>
                                    <td style={{
                                        textAlign: 'right', padding: '14px 16px',
                                        fontFamily: 'monospace', fontSize: '13px',
                                    }}>
                                        {formatCurrency(pos.avg_cost)}
                                    </td>
                                    <td style={{
                                        textAlign: 'right', padding: '14px 16px',
                                        fontFamily: 'monospace', fontSize: '13px',
                                    }}>
                                        {formatCurrency(pos.current_price)}
                                    </td>
                                    <td style={{
                                        textAlign: 'right', padding: '14px 16px',
                                        fontFamily: 'monospace', fontSize: '13px',
                                    }}>
                                        {formatCurrency(pos.market_value)}
                                    </td>
                                    <td style={{
                                        textAlign: 'right', padding: '14px 20px',
                                        fontFamily: 'monospace', fontSize: '13px',
                                        fontWeight: 600,
                                        color: pnlColor(pos.unrealized_pnl),
                                    }}>
                                        {pos.unrealized_pnl >= 0 ? '+' : ''}
                                        {formatCurrency(pos.unrealized_pnl)}
                                        <span style={{ fontSize: '11px', marginLeft: '4px' }}>
                                            ({pos.unrealized_pnl_pct >= 0 ? '+' : ''}
                                            {(pos.unrealized_pnl_pct * 100).toFixed(2)}%)
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
