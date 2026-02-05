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

    const getSeverityClass = (severity: number) => {
        if (severity >= 70) return 'bg-destructive text-destructive-foreground';
        if (severity >= 50) return 'bg-yellow-500 text-white';
        return 'bg-muted text-muted-foreground';
    };

    const getDirectionLabel = (direction: string) => {
        switch (direction) {
            case 'positive': return '📈 上漲';
            case 'negative': return '📉 下跌';
            default: return '➡️ 中性';
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">信號事件</h1>

            {/* Disclaimer */}
            <div className="p-3 bg-muted/50 rounded-lg border text-xs text-muted-foreground">
                ⚠️ 本頁面信號僅供參考，非投資建議。投資有風險，請謹慎評估。
            </div>

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                    載入中...
                </div>
            ) : signals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    目前沒有信號事件
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {signals.map(signal => (
                        <div
                            key={signal.id}
                            className="p-4 bg-card border rounded-lg"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{getSignalIcon(signal.signalType)}</span>
                                    <div>
                                        <div className="text-lg font-semibold">{signal.symbol}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {signal.signalType.replace('_', ' ')}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getSeverityClass(signal.severity)}`}>
                                        {signal.severity}
                                    </span>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        信心度: {(signal.confidence * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>

                            <p className="text-muted-foreground text-sm mb-3">
                                {signal.rationale}
                            </p>

                            <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                                <span>方向: {getDirectionLabel(signal.direction)}</span>
                                <span>停損: ${signal.riskControls.stopLoss.toFixed(2)}</span>
                                <span>建議部位: {signal.riskControls.maxPositionPct}%</span>
                                <span className="ml-auto">{new Date(signal.ts).toLocaleString('zh-TW')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
