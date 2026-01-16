'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface SocialPost {
    id: string;
    platform: string;
    title: string;
    summary: string;
    author: string;
    url: string;
    createdAt: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    urgency: number;
    severity: number;
    keywords: string[];
    location?: string;
    engagement: {
        likes: number;
        comments: number;
        shares: number;
        views: number;
    };
}

interface Filters {
    platform: string;
    sentiment: string;
    minUrgency: number;
    keyword: string;
    location: string;
    from: string;
    to: string;
}

const platforms = ['all', 'facebook', 'instagram', 'twitter', 'ptt', 'rss', 'other'];
const sentiments = ['all', 'positive', 'negative', 'neutral'];

export default function SocialPostsPage() {
    const { getIdToken } = useAuth();
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<Filters>({
        platform: 'all',
        sentiment: 'all',
        minUrgency: 1,
        keyword: '',
        location: '',
        from: '',
        to: '',
    });

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const token = await getIdToken();
            const params = new URLSearchParams();
            if (filters.platform !== 'all') params.append('platform', filters.platform);
            if (filters.sentiment !== 'all') params.append('sentiment', filters.sentiment);
            if (filters.minUrgency > 1) params.append('minUrgency', String(filters.minUrgency));
            if (filters.keyword) params.append('keyword', filters.keyword);
            if (filters.location) params.append('location', filters.location);
            if (filters.from) params.append('from', filters.from);
            if (filters.to) params.append('to', filters.to);

            const res = await fetch(`/api/admin/social/posts?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setPosts(data.posts || []);
            }
        } catch (err) {
            console.error('Failed to fetch posts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    const handleExport = async (format: 'csv' | 'json') => {
        try {
            const token = await getIdToken();
            const params = new URLSearchParams({ format });
            if (filters.platform !== 'all') params.append('platform', filters.platform);

            const res = await fetch(`/api/admin/social/export?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `social_posts_${new Date().toISOString().slice(0, 10)}.${format}`;
                a.click();
            }
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    const getSentimentColor = (s: string) => {
        switch (s) {
            case 'positive': return 'var(--accent-success)';
            case 'negative': return 'var(--accent-danger)';
            default: return 'var(--text-muted)';
        }
    };

    const getPlatformEmoji = (p: string) => {
        switch (p) {
            case 'facebook': return '📘';
            case 'instagram': return '📷';
            case 'twitter': return '🐦';
            case 'ptt': return '📋';
            case 'rss': return '📰';
            default: return '🌐';
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 600 }}>社群貼文監控</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => handleExport('csv')}
                        style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}
                    >
                        匯出 CSV
                    </button>
                    <button
                        onClick={() => handleExport('json')}
                        style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}
                    >
                        匯出 JSON
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px',
                marginBottom: '24px',
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
            }}>
                <select
                    value={filters.platform}
                    onChange={e => setFilters({ ...filters, platform: e.target.value })}
                    style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                >
                    {platforms.map(p => (
                        <option key={p} value={p}>{p === 'all' ? '所有平台' : p}</option>
                    ))}
                </select>

                <select
                    value={filters.sentiment}
                    onChange={e => setFilters({ ...filters, sentiment: e.target.value })}
                    style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                >
                    {sentiments.map(s => (
                        <option key={s} value={s}>{s === 'all' ? '所有情感' : s}</option>
                    ))}
                </select>

                <input
                    type="text"
                    placeholder="關鍵字"
                    value={filters.keyword}
                    onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                    style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />

                <input
                    type="text"
                    placeholder="地區"
                    value={filters.location}
                    onChange={e => setFilters({ ...filters, location: e.target.value })}
                    style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />

                <input
                    type="number"
                    placeholder="最低緊急度"
                    min={1}
                    max={10}
                    value={filters.minUrgency}
                    onChange={e => setFilters({ ...filters, minUrgency: Number(e.target.value) })}
                    style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />

                <button
                    onClick={fetchPosts}
                    style={{ padding: '8px 16px', background: 'var(--accent-primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 500 }}
                >
                    搜尋
                </button>
            </div>

            {/* Posts List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    載入中...
                </div>
            ) : posts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    目前沒有貼文資料
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {posts.map(post => (
                        <div
                            key={post.id}
                            style={{
                                padding: '16px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{getPlatformEmoji(post.platform)}</span>
                                    <span style={{ fontWeight: 500 }}>{post.title}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        background: getSentimentColor(post.sentiment),
                                        color: post.sentiment === 'negative' ? 'white' : 'black',
                                    }}>
                                        {post.sentiment}
                                    </span>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        background: post.severity >= 70 ? 'var(--accent-danger)' : 'var(--bg-tertiary)',
                                        color: post.severity >= 70 ? 'white' : 'var(--text-secondary)',
                                    }}>
                                        嚴重度: {post.severity}
                                    </span>
                                </div>
                            </div>

                            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '14px' }}>
                                {post.summary}
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <span>👍 {post.engagement.likes}</span>
                                    <span>💬 {post.engagement.comments}</span>
                                    <span>🔄 {post.engagement.shares}</span>
                                    <span>👁 {post.engagement.views}</span>
                                </div>
                                <div>
                                    {post.author} • {new Date(post.createdAt).toLocaleString('zh-TW')}
                                </div>
                            </div>

                            {post.keywords.length > 0 && (
                                <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {post.keywords.map(kw => (
                                        <span key={kw} style={{
                                            padding: '2px 8px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: '4px',
                                            fontSize: '11px'
                                        }}>
                                            #{kw}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
