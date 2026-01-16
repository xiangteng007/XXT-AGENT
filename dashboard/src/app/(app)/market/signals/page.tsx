'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface MarketSignal {
    id: string;
    ts: string;
    symbol: string;
    signalType: string;
    severity: number;
    direction: string;
    confidence: number;
    rationale: string;
    riskControls: {
        stopLoss: number;
        maxPositionPct: number;
    };
}

export default function MarketSignalsPage() {
    const { getIdToken } = useAuth();
    const [signals, setSignals] = useState<MarketSignal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSignals() {
            try {
                const token = await getIdToken();
                const res = await fetch('/api/admin/market/signals', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setSignals(data.signals || []);
                }
            } catch (err) {
                console.error('Failed to fetch signals:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchSignals();
    }, [getIdToken]);

    const getSignalIcon = (type: string) => {
        switch (type) {
            case 'price_spike': return '📈';
            case 'volume_spike': return '📊';
            case 'volatility_high': return '⚡';
            case 'news_impact': return '📰';
            default: return '🔔';
        }
    };

    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>信號事件</h1>

            {/* Disclaimer */}
            <div style={{
                padding: '12px 16px',
                background: 'var(--bg-tertiary)',
                borderRadius: '8px',
                marginBottom: '24px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
            }}>
                ⚠️ 本頁面信號僅供參考，非投資建議。投資有風險，請謹慎評估。
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    載入中...
                </div>
            ) : signals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    目前沒有信號事件
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {signals.map(signal => (
                        <div
                            key={signal.id}
                            style={{
                                padding: '16px 20px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '24px' }}>{getSignalIcon(signal.signalType)}</span>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 600 }}>{signal.symbol}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {signal.signalType.replace('_', ' ')}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        display: 'inline-block',
                                        padding: '4px 12px',
                                        borderRadius: '16px',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        background: signal.severity >= 70 ? 'var(--accent-danger)'
                                            : signal.severity >= 50 ? 'var(--accent-warning)'
                                                : 'var(--bg-tertiary)',
                                        color: signal.severity >= 50 ? 'white' : 'var(--text-secondary)',
                                    }}>
                                        {signal.severity}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        信心度: {(signal.confidence * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>

                            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '14px' }}>
                                {signal.rationale}
                            </p>

                            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <span>方向: {signal.direction === 'positive' ? '📈 上漲' : signal.direction === 'negative' ? '📉 下跌' : '➡️ 中性'}</span>
                                <span>停損: ${signal.riskControls.stopLoss.toFixed(2)}</span>
                                <span>建議部位: {signal.riskControls.maxPositionPct}%</span>
                                <span style={{ marginLeft: 'auto' }}>{new Date(signal.ts).toLocaleString('zh-TW')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
