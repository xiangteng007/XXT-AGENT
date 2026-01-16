'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface Keyword {
    id: string;
    keyword: string;
    enabled: boolean;
    priority: 'high' | 'medium' | 'low';
    platforms: string[];
    createdAt: string;
}

export default function SocialKeywordsPage() {
    const { getIdToken } = useAuth();
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKeyword, setNewKeyword] = useState('');
    const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');

    const fetchKeywords = async () => {
        try {
            const token = await getIdToken();
            const res = await fetch('/api/admin/social/keywords', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setKeywords(data.keywords || []);
            }
        } catch (err) {
            console.error('Failed to fetch keywords:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeywords();
    }, [getIdToken]);

    const handleAdd = async () => {
        if (!newKeyword.trim()) return;

        try {
            const token = await getIdToken();
            const res = await fetch('/api/admin/social/keywords', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    keyword: newKeyword.trim(),
                    priority: newPriority,
                    enabled: true,
                    platforms: ['all'],
                }),
            });

            if (res.ok) {
                setNewKeyword('');
                fetchKeywords();
            }
        } catch (err) {
            console.error('Failed to add keyword:', err);
        }
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        try {
            const token = await getIdToken();
            await fetch(`/api/admin/social/keywords/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ enabled: !enabled }),
            });
            fetchKeywords();
        } catch (err) {
            console.error('Failed to toggle keyword:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('確定要刪除此關鍵字嗎？')) return;

        try {
            const token = await getIdToken();
            await fetch(`/api/admin/social/keywords/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchKeywords();
        } catch (err) {
            console.error('Failed to delete keyword:', err);
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'high': return 'var(--accent-danger)';
            case 'medium': return 'var(--accent-warning)';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>關鍵字管理</h1>

            {/* Add new keyword */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '24px',
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
            }}>
                <input
                    type="text"
                    placeholder="新增關鍵字..."
                    value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    style={{
                        flex: 1,
                        padding: '10px 16px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                    }}
                />
                <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as 'high' | 'medium' | 'low')}
                    style={{
                        padding: '10px 16px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                    }}
                >
                    <option value="high">高優先</option>
                    <option value="medium">中優先</option>
                    <option value="low">低優先</option>
                </select>
                <button
                    onClick={handleAdd}
                    style={{
                        padding: '10px 24px',
                        background: 'var(--accent-primary)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    新增
                </button>
            </div>

            {/* Keywords list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    載入中...
                </div>
            ) : keywords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    尚未設定任何關鍵字
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {keywords.map(kw => (
                        <div
                            key={kw.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                opacity: kw.enabled ? 1 : 0.5,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span
                                    style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: getPriorityColor(kw.priority),
                                    }}
                                />
                                <span style={{ fontWeight: 500 }}>{kw.keyword}</span>
                                <span style={{
                                    padding: '2px 8px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                }}>
                                    {kw.priority}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleToggle(kw.id, kw.enabled)}
                                    style={{
                                        padding: '6px 12px',
                                        background: kw.enabled ? 'var(--accent-success)' : 'var(--bg-tertiary)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: kw.enabled ? 'white' : 'var(--text-secondary)',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {kw.enabled ? '啟用中' : '已停用'}
                                </button>
                                <button
                                    onClick={() => handleDelete(kw.id)}
                                    style={{
                                        padding: '6px 12px',
                                        background: 'transparent',
                                        border: '1px solid var(--accent-danger)',
                                        borderRadius: '6px',
                                        color: 'var(--accent-danger)',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    刪除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
