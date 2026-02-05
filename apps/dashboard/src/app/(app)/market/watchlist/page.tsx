'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface WatchlistItem {
    id: string;
    symbol: string;
    assetClass: string;
    enabled: boolean;
    thresholds: {
        spikePct1m: number;
        spikePct5m: number;
        volumeSpikeFactor: number;
    };
    createdAt: string;
}

export default function MarketWatchlistPage() {
    const { getIdToken } = useAuth();
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newSymbol, setNewSymbol] = useState('');
    const [newAssetClass, setNewAssetClass] = useState<'stock' | 'fund' | 'future'>('stock');

    const fetchItems = async () => {
        try {
            const token = await getIdToken();
            const res = await fetch('/api/admin/market/watchlist', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setItems(data.items || []);
            }
        } catch (err) {
            console.error('Failed to fetch watchlist:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [getIdToken]);

    const handleAdd = async () => {
        if (!newSymbol.trim()) return;

        try {
            const token = await getIdToken();
            await fetch('/api/admin/market/watchlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    symbol: newSymbol.trim().toUpperCase(),
                    assetClass: newAssetClass,
                    enabled: true,
                    thresholds: {
                        spikePct1m: 0.8,
                        spikePct5m: 1.5,
                        volumeSpikeFactor: 2.0,
                    },
                }),
            });
            setNewSymbol('');
            fetchItems();
        } catch (err) {
            console.error('Failed to add symbol:', err);
        }
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        try {
            const token = await getIdToken();
            await fetch(`/api/admin/market/watchlist/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ enabled: !enabled }),
            });
            fetchItems();
        } catch (err) {
            console.error('Failed to toggle:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('確定要刪除此監控項目嗎？')) return;

        try {
            const token = await getIdToken();
            await fetch(`/api/admin/market/watchlist/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchItems();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    const getAssetIcon = (a: string) => {
        switch (a) {
            case 'stock': return '📈';
            case 'fund': return '💰';
            case 'future': return '📊';
            default: return '📈';
        }
    };

    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>監控清單</h1>

            {/* Add new symbol */}
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
                    placeholder="輸入股票代碼..."
                    value={newSymbol}
                    onChange={e => setNewSymbol(e.target.value)}
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
                    value={newAssetClass}
                    onChange={e => setNewAssetClass(e.target.value as any)}
                    style={{
                        padding: '10px 16px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                    }}
                >
                    <option value="stock">股票</option>
                    <option value="fund">基金</option>
                    <option value="future">期貨</option>
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

            {/* Watchlist */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    載入中...
                </div>
            ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    尚未設定任何監控項目
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {items.map(item => (
                        <div
                            key={item.id}
                            style={{
                                padding: '16px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                opacity: item.enabled ? 1 : 0.5,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '20px' }}>{getAssetIcon(item.assetClass)}</span>
                                    <span style={{ fontSize: '18px', fontWeight: 600 }}>{item.symbol}</span>
                                </div>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    style={{
                                        padding: '4px 8px',
                                        background: 'transparent',
                                        border: '1px solid var(--accent-danger)',
                                        borderRadius: '4px',
                                        color: 'var(--accent-danger)',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    刪除
                                </button>
                            </div>

                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                <div>1分鐘警報: {item.thresholds.spikePct1m}%</div>
                                <div>5分鐘警報: {item.thresholds.spikePct5m}%</div>
                                <div>成交量倍數: {item.thresholds.volumeSpikeFactor}x</div>
                            </div>

                            <button
                                onClick={() => handleToggle(item.id, item.enabled)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    background: item.enabled ? 'var(--accent-success)' : 'var(--bg-tertiary)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: item.enabled ? 'white' : 'var(--text-secondary)',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                }}
                            >
                                {item.enabled ? '監控中' : '已暫停'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
