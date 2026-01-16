'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface Stats {
    total: number;
    byPlatform: Record<string, number>;
    bySentiment: Record<string, number>;
    avgUrgency: number;
    avgSeverity: number;
    postsToday: number;
    alertsToday: number;
    topKeywords: { keyword: string; count: number }[];
}

export default function SocialStatsPage() {
    const { getIdToken } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                const token = await getIdToken();
                const res = await fetch('/api/admin/social/stats', {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, [getIdToken]);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                載入中...
            </div>
        );
    }

    if (!stats) {
        return (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                無法載入統計資料
            </div>
        );
    }

    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>統計數據</h1>

            {/* Summary Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '32px'
            }}>
                <StatCard title="總貼文數" value={stats.total} suffix="則" />
                <StatCard title="今日貼文" value={stats.postsToday} suffix="則" accent />
                <StatCard title="今日警報" value={stats.alertsToday} suffix="則" danger={stats.alertsToday > 0} />
                <StatCard title="平均緊急度" value={stats.avgUrgency.toFixed(1)} suffix="/10" />
                <StatCard title="平均嚴重度" value={stats.avgSeverity.toFixed(1)} suffix="/100" />
            </div>

            {/* Platform Breakdown */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '24px'
            }}>
                <div style={{
                    padding: '20px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>平台分布</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {Object.entries(stats.byPlatform).map(([platform, count]) => (
                            <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ width: '80px', fontSize: '14px' }}>{platform}</span>
                                <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${(count / stats.total) * 100}%`,
                                        height: '100%',
                                        background: 'var(--accent-primary)',
                                        borderRadius: '4px',
                                    }} />
                                </div>
                                <span style={{ width: '60px', textAlign: 'right', fontSize: '14px' }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{
                    padding: '20px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>情感分析</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {Object.entries(stats.bySentiment).map(([sentiment, count]) => {
                            const color = sentiment === 'positive' ? 'var(--accent-success)'
                                : sentiment === 'negative' ? 'var(--accent-danger)'
                                    : 'var(--text-muted)';
                            return (
                                <div key={sentiment} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ width: '80px', fontSize: '14px' }}>{sentiment}</span>
                                    <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${(count / stats.total) * 100}%`,
                                            height: '100%',
                                            background: color,
                                            borderRadius: '4px',
                                        }} />
                                    </div>
                                    <span style={{ width: '60px', textAlign: 'right', fontSize: '14px' }}>{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{
                    padding: '20px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>熱門關鍵字</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {stats.topKeywords.map((kw, idx) => (
                            <span key={kw.keyword} style={{
                                padding: '6px 12px',
                                background: idx < 3 ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: idx < 3 ? 'white' : 'var(--text-primary)',
                                borderRadius: '16px',
                                fontSize: '13px',
                            }}>
                                {kw.keyword} ({kw.count})
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    suffix = '',
    accent = false,
    danger = false,
}: {
    title: string;
    value: number | string;
    suffix?: string;
    accent?: boolean;
    danger?: boolean;
}) {
    return (
        <div style={{
            padding: '20px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
        }}>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                {title}
            </div>
            <div style={{
                fontSize: '32px',
                fontWeight: 700,
                color: danger ? 'var(--accent-danger)' : accent ? 'var(--accent-primary)' : 'var(--text-primary)',
            }}>
                {value}
                <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '4px' }}>
                    {suffix}
                </span>
            </div>
        </div>
    );
}
