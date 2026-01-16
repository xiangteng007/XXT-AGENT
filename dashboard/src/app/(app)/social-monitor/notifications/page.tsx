'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface NotificationSetting {
    id: string;
    channel: 'telegram' | 'line' | 'webhook' | 'email' | 'slack';
    enabled: boolean;
    name: string;
    config: Record<string, string>;
    minSeverity: number;
    minUrgency: number;
    createdAt: string;
}

const channelIcons: Record<string, string> = {
    telegram: '📱',
    line: '💬',
    webhook: '🔗',
    email: '📧',
    slack: '💼',
};

const channelFields: Record<string, { field: string; label: string; type: string }[]> = {
    telegram: [
        { field: 'botToken', label: 'Bot Token', type: 'password' },
        { field: 'chatId', label: 'Chat ID', type: 'text' },
    ],
    line: [
        { field: 'accessToken', label: 'Access Token', type: 'password' },
    ],
    webhook: [
        { field: 'url', label: 'Webhook URL', type: 'url' },
        { field: 'headers', label: 'Headers (JSON)', type: 'text' },
    ],
    email: [
        { field: 'recipients', label: '收件人 (逗號分隔)', type: 'text' },
    ],
    slack: [
        { field: 'webhookUrl', label: 'Webhook URL', type: 'url' },
        { field: 'channel', label: 'Channel', type: 'text' },
    ],
};

export default function SocialNotificationsPage() {
    const { getIdToken } = useAuth();
    const [settings, setSettings] = useState<NotificationSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState({
        channel: 'telegram' as NotificationSetting['channel'],
        name: '',
        config: {} as Record<string, string>,
        minSeverity: 50,
        minUrgency: 5,
        enabled: true,
    });

    const fetchSettings = async () => {
        try {
            const token = await getIdToken();
            const res = await fetch('/api/admin/social/notifications', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setSettings(data.notifications || []);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, [getIdToken]);

    const handleSave = async () => {
        try {
            const token = await getIdToken();
            const method = editingId ? 'PUT' : 'POST';
            const url = editingId
                ? `/api/admin/social/notifications/${editingId}`
                : '/api/admin/social/notifications';

            await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(form),
            });

            setShowModal(false);
            setEditingId(null);
            setForm({
                channel: 'telegram',
                name: '',
                config: {},
                minSeverity: 50,
                minUrgency: 5,
                enabled: true,
            });
            fetchSettings();
        } catch (err) {
            console.error('Failed to save notification:', err);
        }
    };

    const handleEdit = (setting: NotificationSetting) => {
        setEditingId(setting.id);
        setForm({
            channel: setting.channel,
            name: setting.name,
            config: setting.config,
            minSeverity: setting.minSeverity,
            minUrgency: setting.minUrgency,
            enabled: setting.enabled,
        });
        setShowModal(true);
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        try {
            const token = await getIdToken();
            await fetch(`/api/admin/social/notifications/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ enabled: !enabled }),
            });
            fetchSettings();
        } catch (err) {
            console.error('Failed to toggle:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('確定要刪除此通知設定嗎？')) return;

        try {
            const token = await getIdToken();
            await fetch(`/api/admin/social/notifications/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchSettings();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 600 }}>通知設定</h1>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setForm({
                            channel: 'telegram',
                            name: '',
                            config: {},
                            minSeverity: 50,
                            minUrgency: 5,
                            enabled: true,
                        });
                        setShowModal(true);
                    }}
                    style={{
                        padding: '10px 20px',
                        background: 'var(--accent-primary)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    + 新增通知
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    載入中...
                </div>
            ) : settings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    尚未設定任何通知
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {settings.map(s => (
                        <div
                            key={s.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '16px 20px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                opacity: s.enabled ? 1 : 0.5,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{ fontSize: '24px' }}>{channelIcons[s.channel]}</span>
                                <div>
                                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {s.channel} • 嚴重度 ≥{s.minSeverity} • 緊急度 ≥{s.minUrgency}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleToggle(s.id, s.enabled)}
                                    style={{
                                        padding: '6px 12px',
                                        background: s.enabled ? 'var(--accent-success)' : 'var(--bg-tertiary)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: s.enabled ? 'white' : 'var(--text-secondary)',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {s.enabled ? '啟用中' : '已停用'}
                                </button>
                                <button
                                    onClick={() => handleEdit(s)}
                                    style={{
                                        padding: '6px 12px',
                                        background: 'var(--bg-tertiary)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: 'var(--text-primary)',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    編輯
                                </button>
                                <button
                                    onClick={() => handleDelete(s.id)}
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

            {/* Modal */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 3000,
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        style={{
                            background: 'var(--bg-elevated)',
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '480px',
                            padding: '24px',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>
                            {editingId ? '編輯通知' : '新增通知'}
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>名稱</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="例：緊急事件通知"
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)',
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>頻道</label>
                                <select
                                    value={form.channel}
                                    onChange={e => setForm({ ...form, channel: e.target.value as any, config: {} })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)',
                                    }}
                                >
                                    <option value="telegram">Telegram</option>
                                    <option value="line">LINE Notify</option>
                                    <option value="webhook">Webhook</option>
                                    <option value="email">Email</option>
                                    <option value="slack">Slack</option>
                                </select>
                            </div>

                            {channelFields[form.channel]?.map(field => (
                                <div key={field.field}>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>{field.label}</label>
                                    <input
                                        type={field.type}
                                        value={form.config[field.field] || ''}
                                        onChange={e => setForm({
                                            ...form,
                                            config: { ...form.config, [field.field]: e.target.value },
                                        })}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            background: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px',
                                            color: 'var(--text-primary)',
                                        }}
                                    />
                                </div>
                            ))}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>最低嚴重度</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={form.minSeverity}
                                        onChange={e => setForm({ ...form, minSeverity: Number(e.target.value) })}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            background: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px',
                                            color: 'var(--text-primary)',
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>最低緊急度</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={form.minUrgency}
                                        onChange={e => setForm({ ...form, minUrgency: Number(e.target.value) })}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            background: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px',
                                            color: 'var(--text-primary)',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    padding: '10px 20px',
                                    background: 'var(--bg-tertiary)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSave}
                                style={{
                                    padding: '10px 20px',
                                    background: 'var(--accent-primary)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                儲存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
