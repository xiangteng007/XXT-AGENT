'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';

// ── Types ────────────────────────────────────────────────

interface MarketNews {
    id: string;
    ts: string;
    title: string;
    source: string;
    url: string;
    relatedSymbols: string[];
    sentiment: string;
    severity: number;
    tripleFusion?: {
        signal?: string;
        confidence?: number;
    } | null;
    summary?: string | null;
}

interface TripleFusionContext {
    marketRegime: string;
    overallSentiment: string;
    keyThemes: string[];
    lastUpdate: string;
}

// ── Component ────────────────────────────────────────────

export default function MarketNewsPage() {
    const { getIdToken } = useAuth();
    const [news, setNews] = useState<MarketNews[]>([]);
    const [tripleFusion, setTripleFusion] = useState<TripleFusionContext | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');

    const fetchNews = useCallback(async () => {
        try {
            const token = await getIdToken();
            const res = await fetch('/api/market/news', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setNews(data.news || []);
                setTripleFusion(data.tripleFusion || null);
            }
        } catch (err) {
            console.error('Failed to fetch news:', err);
        } finally {
            setLoading(false);
        }
    }, [getIdToken]);

    useEffect(() => {
        fetchNews();
        // Auto-refresh every 2 minutes
        const interval = setInterval(fetchNews, 120_000);
        return () => clearInterval(interval);
    }, [fetchNews]);

    const filteredNews = filter === 'all'
        ? news
        : news.filter(n => n.sentiment === filter);

    const getSentimentEmoji = (s: string) => {
        switch (s) {
            case 'positive': return '🟢';
            case 'negative': return '🔴';
            default: return '⚪';
        }
    };

    const getRegimeStyle = (regime: string) => {
        switch (regime) {
            case 'bull': return { color: '#10b981', label: '🐂 牛市' };
            case 'bear': return { color: '#ef4444', label: '🐻 熊市' };
            case 'volatile': return { color: '#a855f7', label: '⚡ 波動' };
            default: return { color: '#f59e0b', label: '📊 盤整' };
        }
    };

    return (
        <div>
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '24px',
            }}>
                <h1 style={{ fontSize: '24px', fontWeight: 600 }}>📰 即時新聞 & 市場情報</h1>
                <button
                    onClick={() => { setLoading(true); fetchNews(); }}
                    style={{
                        padding: '6px 16px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '13px',
                    }}
                >
                    🔄 重新整理
                </button>
            </div>

            {/* Triple Fusion Context Banner */}
            {tripleFusion && (
                <div style={{
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    border: '1px solid #D97706/30',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    marginBottom: '20px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 2fr',
                    gap: '24px',
                    alignItems: 'center',
                }}>
                    {/* Regime */}
                    <div>
                        <span style={{
                            fontSize: '10px', color: '#9ca3af',
                            textTransform: 'uppercase', letterSpacing: '1px',
                        }}>
                            TRIPLE FUSION 市場狀態
                        </span>
                        <div style={{
                            fontSize: '20px', fontWeight: 700, marginTop: '4px',
                            color: getRegimeStyle(tripleFusion.marketRegime).color,
                        }}>
                            {getRegimeStyle(tripleFusion.marketRegime).label}
                        </div>
                    </div>
                    {/* Overall Sentiment */}
                    <div>
                        <span style={{
                            fontSize: '10px', color: '#9ca3af',
                            textTransform: 'uppercase', letterSpacing: '1px',
                        }}>
                            整體情緒
                        </span>
                        <div style={{
                            fontSize: '16px', fontWeight: 600, marginTop: '4px',
                            color: tripleFusion.overallSentiment === 'positive' ? '#10b981' :
                                   tripleFusion.overallSentiment === 'negative' ? '#ef4444' : '#f59e0b',
                        }}>
                            {getSentimentEmoji(tripleFusion.overallSentiment)}{' '}
                            {tripleFusion.overallSentiment === 'positive' ? '樂觀' :
                             tripleFusion.overallSentiment === 'negative' ? '悲觀' : '中性'}
                        </div>
                    </div>
                    {/* Key Themes */}
                    <div>
                        <span style={{
                            fontSize: '10px', color: '#9ca3af',
                            textTransform: 'uppercase', letterSpacing: '1px',
                        }}>
                            關鍵主題
                        </span>
                        <div style={{
                            display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px',
                        }}>
                            {tripleFusion.keyThemes.slice(0, 6).map((theme, i) => (
                                <span key={i} style={{
                                    padding: '3px 10px', borderRadius: '12px',
                                    fontSize: '11px', fontWeight: 500,
                                    background: '#D97706/15', color: '#D97706',
                                    border: '1px solid #D97706/25',
                                }}>
                                    {theme}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div style={{
                display: 'flex', gap: '8px', marginBottom: '16px',
            }}>
                {(['all', 'positive', 'negative', 'neutral'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: '6px 16px', borderRadius: '20px',
                            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                            border: filter === f ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            background: filter === f ? 'var(--accent-primary)' : 'transparent',
                            color: filter === f ? 'white' : 'var(--text-secondary)',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {f === 'all' ? '全部' :
                         f === 'positive' ? '🟢 正面' :
                         f === 'negative' ? '🔴 負面' : '⚪ 中性'}
                    </button>
                ))}
                <span style={{
                    marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)',
                    alignSelf: 'center',
                }}>
                    {filteredNews.length} 則新聞
                </span>
            </div>

            {/* News List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                    載入新聞中...
                </div>
            ) : filteredNews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    目前沒有{filter !== 'all' ? `${filter === 'positive' ? '正面' : filter === 'negative' ? '負面' : '中性'}` : ''}新聞資料
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredNews.map(item => (
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
                                transition: 'all 0.15s ease',
                                borderLeft: `3px solid ${
                                    item.sentiment === 'positive' ? '#10b981' :
                                    item.sentiment === 'negative' ? '#ef4444' : '#6b7280'
                                }`,
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = 'var(--bg-tertiary)';
                                e.currentTarget.style.transform = 'translateX(4px)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = 'var(--bg-secondary)';
                                e.currentTarget.style.transform = 'translateX(0)';
                            }}
                        >
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                            }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '8px', lineHeight: '1.4' }}>
                                        {getSentimentEmoji(item.sentiment)} {item.title}
                                    </h3>
                                    <div style={{
                                        display: 'flex', gap: '12px', fontSize: '12px',
                                        color: 'var(--text-muted)', alignItems: 'center',
                                    }}>
                                        <span>📰 {item.source}</span>
                                        <span>{new Date(item.ts).toLocaleString('zh-TW')}</span>
                                        {item.summary && (
                                            <span style={{
                                                fontSize: '11px', color: 'var(--text-muted)',
                                                fontStyle: 'italic',
                                            }}>
                                                — {item.summary.slice(0, 80)}...
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'flex-end', gap: '6px', minWidth: '80px',
                                }}>
                                    {/* Severity */}
                                    <span style={{
                                        padding: '2px 10px', borderRadius: '12px',
                                        fontSize: '11px', fontWeight: 600,
                                        background: item.severity >= 70 ? '#ef4444' :
                                                    item.severity >= 40 ? '#f59e0b' : '#6b7280',
                                        color: 'white',
                                    }}>
                                        嚴重度 {item.severity}
                                    </span>

                                    {/* Triple Fusion badge */}
                                    {item.tripleFusion?.signal && (
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '12px',
                                            fontSize: '10px', fontWeight: 600,
                                            background: '#a855f7/20', color: '#a855f7',
                                            border: '1px solid #a855f7/30',
                                        }}>
                                            TF: {item.tripleFusion.signal}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Related Symbols */}
                            {item.relatedSymbols.length > 0 && (
                                <div style={{
                                    marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap',
                                }}>
                                    {item.relatedSymbols.map(s => (
                                        <span key={s} style={{
                                            padding: '2px 10px',
                                            background: '#3b82f6/15',
                                            border: '1px solid #3b82f6/25',
                                            borderRadius: '12px',
                                            fontSize: '11px',
                                            color: '#60a5fa',
                                            fontWeight: 500,
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
