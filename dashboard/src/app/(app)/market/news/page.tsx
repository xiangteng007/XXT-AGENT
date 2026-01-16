'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface MarketNews {
    id: string;
    ts: string;
    title: string;
    source: string;
    url: string;
    relatedSymbols: string[];
    sentiment: string;
    severity: number;
}

export default function MarketNewsPage() {
    const { getIdToken } = useAuth();
    const [news, setNews] = useState<MarketNews[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchNews() {
            try {
                const token = await getIdToken();
                const res = await fetch('/api/admin/market/news', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setNews(data.news || []);
                }
            } catch (err) {
                console.error('Failed to fetch news:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchNews();
    }, [getIdToken]);

    const getSentimentColor = (s: string) => {
        switch (s) {
            case 'positive': return 'var(--accent-success)';
            case 'negative': return 'var(--accent-danger)';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>即時新聞</h1>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    載入中...
                </div>
            ) : news.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    目前沒有新聞資料
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {news.map(item => (
                        <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'block',
                                padding: '16px 20px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                textDecoration: 'none',
                                color: 'inherit',
                                transition: 'background 0.15s ease',
                            }}
                            onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                            onMouseOut={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
                                        {item.title}
                                    </h3>
                                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        <span>📰 {item.source}</span>
                                        <span>{new Date(item.ts).toLocaleString('zh-TW')}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        background: getSentimentColor(item.sentiment),
                                        color: item.sentiment === 'negative' ? 'white' : 'black',
                                    }}>
                                        {item.sentiment}
                                    </span>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        background: item.severity >= 60 ? 'var(--accent-danger)' : 'var(--bg-tertiary)',
                                        color: item.severity >= 60 ? 'white' : 'var(--text-secondary)',
                                    }}>
                                        {item.severity}
                                    </span>
                                </div>
                            </div>

                            {item.relatedSymbols.length > 0 && (
                                <div style={{ marginTop: '12px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {item.relatedSymbols.map(s => (
                                        <span key={s} style={{
                                            padding: '2px 8px',
                                            background: 'var(--accent-primary)',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            color: 'white',
                                        }}>
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
