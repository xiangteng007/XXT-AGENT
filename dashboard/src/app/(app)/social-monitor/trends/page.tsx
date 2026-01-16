'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface TrendItem {
    keyword: string;
    count: number;
    change: number; // percentage change
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    platforms: string[];
    lastSeen: string;
}

export default function SocialTrendsPage() {
    const { getIdToken } = useAuth();
    const [trends, setTrends] = useState<TrendItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('24h');

    useEffect(() => {
        async function fetchTrends() {
            setLoading(true);
            try {
                const token = await getIdToken();
                const res = await fetch(`/api/admin/social/trends?range=${timeRange}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (res.ok) {
                    const data = await res.json();
                    setTrends(data.trends || []);
                }
            } catch (err) {
                console.error('Failed to fetch trends:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchTrends();
    }, [timeRange, getIdToken]);

    const getSentimentColor = (s: string) => {
        switch (s) {
            case 'positive': return 'var(--accent-success)';
            case 'negative': return 'var(--accent-danger)';
            case 'mixed': return 'var(--accent-warning)';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 600 }}>趨勢分析</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {['1h', '24h', '7d', '30d'].map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            style={{
                                padding: '8px 16px',
                                background: timeRange === range ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                color: timeRange === range ? 'white' : 'var(--text-primary)',
                            }}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    載入中...
                </div>
            ) : trends.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    目前沒有趨勢資料
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '16px'
                }}>
                    {trends.map((trend, idx) => (
                        <div
                            key={trend.keyword}
                            style={{
                                padding: '20px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <span style={{
                                        fontSize: '14px',
                                        color: 'var(--text-muted)',
                                        marginRight: '8px',
                                    }}>
                                        #{idx + 1}
                                    </span>
                                    <span style={{ fontSize: '18px', fontWeight: 600 }}>
                                        {trend.keyword}
                                    </span>
                                </div>
                                <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    background: getSentimentColor(trend.sentiment),
                                    color: trend.sentiment === 'negative' ? 'white' : 'black',
                                }}>
                                    {trend.sentiment}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
                                <span style={{ fontSize: '28px', fontWeight: 700 }}>{trend.count}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>則貼文</span>
                                <span style={{
                                    color: trend.change >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                }}>
                                    {trend.change >= 0 ? '↑' : '↓'} {Math.abs(trend.change)}%
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                {trend.platforms.map(p => (
                                    <span key={p} style={{
                                        padding: '2px 8px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                    }}>
                                        {p}
                                    </span>
                                ))}
                            </div>

                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                最後出現: {new Date(trend.lastSeen).toLocaleString('zh-TW')}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
