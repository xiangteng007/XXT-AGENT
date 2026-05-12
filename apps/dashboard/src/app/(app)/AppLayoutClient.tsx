'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { AppShellProvider, AppShell, Header, Sidebar, MobileBottom } from '@/components/layout';
import { Breadcrumb } from '@/components/ui/breadcrumb-nav';
import '@/styles/appshell.css';

interface AdminInfo {
    uid: string;
    role: 'owner' | 'admin' | 'viewer';
    enabled: boolean;
    email: string;
}

interface FusedEvent {
    id: string;
    title: string;
    domain: string;
    severity: number;
    ts: string;
}

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
    const { user, loading, logout, getIdToken, isConfigured } = useAuth();
    const router = useRouter();
    const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
    const [checkingAdmin, setCheckingAdmin] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<FusedEvent[]>([]);

    // ── SSE real-time notifications ──
    const { notifications: sseEvents, connected: sseConnected } = useNotifications(30);

    // Merge SSE events into the notification list
    const mergeSSENotifications = useCallback(() => {
        if (sseEvents.length === 0) return;

        setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const newEvents: FusedEvent[] = sseEvents
                .filter(e => !existingIds.has(e.id))
                .map(e => ({
                    id: e.id,
                    title: e.title || e.message,
                    domain: e.type === 'market' || e.type === 'news' || e.type === 'social' || e.type === 'guardian' || e.type === 'system'
                        ? e.type : 'system',
                    severity: e.severity === 'error' ? 8 : e.severity === 'warning' ? 5 : 2,
                    ts: e.timestamp,
                }));

            if (newEvents.length === 0) return prev;
            return [...newEvents, ...prev].slice(0, 50);
        });
    }, [sseEvents]);

    useEffect(() => {
        mergeSSENotifications();
    }, [mergeSSENotifications]);

    // Redirect if not logged in (only if Firebase is configured)
    useEffect(() => {
        if (!loading && !user && isConfigured) {
            router.push('/login');
        }
        // If Firebase is not configured, skip auth check
        if (!isConfigured) {
            setCheckingAdmin(false);
        }
    }, [user, loading, router, isConfigured]);

    // Check admin permissions
    useEffect(() => {
        async function checkAdmin() {
            if (!user || !isConfigured) return;

            try {
                const token = await getIdToken();
                const res = await fetch('/api/admin/me', {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    setError('您沒有管理員權限');
                    setAdminInfo(null);
                } else {
                    const data = await res.json();
                    setAdminInfo(data);
                    setError(null);
                }
            } catch (err) {
                setError('驗證失敗');
            } finally {
                setCheckingAdmin(false);
            }
        }

        if (user) {
            checkAdmin();
        }
    }, [user, getIdToken, isConfigured]);

    // ── Polling fallback for initial data + SSE gap recovery ──
    // SSE provides real-time events (wired above via useNotifications)
    // Polling ensures we have historical data on page load
    useEffect(() => {
        if (!user || !adminInfo || !isConfigured) return;

        // Initial fetch for existing notifications
        async function fetchNotifications() {
            try {
                const token = await getIdToken();
                const res = await fetch('/api/admin/fused-events?limit=20', {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (res.ok) {
                    const data = await res.json();
                    setNotifications(data.events || []);
                }
            } catch (err) {
                console.error('Failed to fetch notifications:', err);
            }
        }

        fetchNotifications();
        // Reduced polling frequency since SSE handles real-time
        const interval = setInterval(fetchNotifications, 120000);
        return () => clearInterval(interval);
    }, [user, adminInfo, getIdToken, isConfigured]);

    // Loading state
    if (loading || checkingAdmin) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'var(--bg-primary, #0a0a0f)',
                color: 'var(--text-primary, #f0f0f5)',
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid var(--border-color, #2a2a3a)',
                    borderTopColor: 'var(--accent-primary, #6366f1)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }} />
                <p style={{ marginTop: '16px' }}>驗證中...</p>
                <style>{`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    // If Firebase is not configured, show dashboard without auth
    if (!isConfigured) {
        return (
            <AppShellProvider>
                <AppShell
                    header={
                        <Header
                            notifications={[]}
                            showWidgetEdit={false}
                        />
                    }
                    sidebar={<Sidebar />}
                    mobileBottom={<MobileBottom />}
                >
                    {children}
                </AppShell>
            </AppShellProvider>
        );
    }

    // Access denied
    if (error || !adminInfo) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'var(--bg-primary, #0a0a0f)',
                color: 'var(--text-primary, #f0f0f5)',
                textAlign: 'center',
                padding: '24px',
            }}>
                <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</h1>
                <h2 style={{ marginBottom: '8px' }}>拒絕存取</h2>
                <p style={{ color: 'var(--text-secondary, #a0a0b0)', marginBottom: '8px' }}>
                    {error || '您沒有權限存取此頁面'}
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-muted, #606070)', marginBottom: '24px' }}>
                    登入帳號: {user?.email}
                </p>
                <button
                    onClick={logout}
                    style={{
                        padding: '10px 24px',
                        background: 'var(--bg-tertiary, #1a1a24)',
                        border: '1px solid var(--border-color, #2a2a3a)',
                        borderRadius: '8px',
                        color: 'var(--text-primary, #f0f0f5)',
                        cursor: 'pointer',
                    }}
                >
                    登出
                </button>
            </div>
        );
    }

    return (
        <AppShellProvider>
            <AppShell
                header={
                    <Header
                        notifications={notifications}
                        showWidgetEdit={adminInfo.role === 'owner'}
                    />
                }
                sidebar={<Sidebar />}
                mobileBottom={<MobileBottom />}
            >
                <Breadcrumb />
                {children}
            </AppShell>
        </AppShellProvider>
    );
}
