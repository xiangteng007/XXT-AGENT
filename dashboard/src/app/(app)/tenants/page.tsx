'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import styles from './tenants.module.css';

interface Tenant {
    id: string;
    destination: string;
    channelId: string;
    notionWorkspaceId: string;
    defaultDatabaseId: string;
    settings: {
        timezone: string;
        retentionDays: number;
        enabled: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

export default function TenantsPage() {
    const { getIdToken } = useAuth();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        id: '',
        destination: '',
        channelId: '',
        notionWorkspaceId: '',
        defaultDatabaseId: '',
        timezone: 'Asia/Taipei',
    });

    const loadTenants = async () => {
        try {
            const token = await getIdToken();
            const res = await fetch('/api/admin/tenants', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setTenants(data.tenants);
            }
        } catch (err) {
            console.error('Failed to load tenants:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTenants();
    }, [getIdToken]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = await getIdToken();
            const res = await fetch('/api/admin/tenants', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setShowForm(false);
                setFormData({ id: '', destination: '', channelId: '', notionWorkspaceId: '', defaultDatabaseId: '', timezone: 'Asia/Taipei' });
                loadTenants();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to create tenant');
            }
        } catch (err) {
            console.error('Create tenant error:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(`確定要刪除租戶 ${id}？此操作無法復原。`)) return;

        try {
            const token = await getIdToken();
            const res = await fetch(`/api/admin/tenants/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                loadTenants();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to delete tenant');
            }
        } catch (err) {
            console.error('Delete tenant error:', err);
        }
    };

    return (
        <div>
            <div className={styles.header}>
                <h1>租戶管理</h1>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? '取消' : '➕ 新增租戶'}
                </button>
            </div>

            {showForm && (
                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.formGrid}>
                        <div>
                            <label className="label">租戶 ID *</label>
                            <input
                                className="input"
                                value={formData.id}
                                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                                placeholder="unique-tenant-id"
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Destination / Channel ID *</label>
                            <input
                                className="input"
                                value={formData.destination}
                                onChange={(e) => setFormData({ ...formData, destination: e.target.value, channelId: e.target.value })}
                                placeholder="LINE Channel ID"
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Notion Workspace ID</label>
                            <input
                                className="input"
                                value={formData.notionWorkspaceId}
                                onChange={(e) => setFormData({ ...formData, notionWorkspaceId: e.target.value })}
                                placeholder="Optional"
                            />
                        </div>
                        <div>
                            <label className="label">Default Database ID</label>
                            <input
                                className="input"
                                value={formData.defaultDatabaseId}
                                onChange={(e) => setFormData({ ...formData, defaultDatabaseId: e.target.value })}
                                placeholder="Notion Database ID"
                            />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary">建立租戶</button>
                </form>
            )}

            {loading ? (
                <p>載入中...</p>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Destination</th>
                            <th>Notion DB</th>
                            <th>狀態</th>
                            <th>更新時間</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tenants.map((t) => (
                            <tr key={t.id}>
                                <td><code>{t.id}</code></td>
                                <td>{t.destination}</td>
                                <td><code>{t.defaultDatabaseId?.slice(0, 8)}...</code></td>
                                <td>
                                    <span className={`badge ${t.settings?.enabled !== false ? 'badge-success' : 'badge-error'}`}>
                                        {t.settings?.enabled !== false ? '啟用' : '停用'}
                                    </span>
                                </td>
                                <td>{t.updatedAt?.slice(0, 10)}</td>
                                <td>
                                    <button className="btn btn-secondary" onClick={() => alert('Edit coming soon')}>
                                        編輯
                                    </button>
                                    <button className="btn btn-danger" onClick={() => handleDelete(t.id)}>
                                        刪除
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {tenants.length === 0 && (
                            <tr><td colSpan={6} className="text-center">尚無租戶</td></tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
}
