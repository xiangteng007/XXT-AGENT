'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAppShell } from './AppShell';
import { useAuth } from '@/lib/AuthContext';

// Icons (inline SVG for simplicity)
const MenuIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
);

const BellIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const SettingsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

interface Notification {
    id: string;
    title: string;
    domain: string;
    severity: number;
    ts: string;
}

interface HeaderProps {
    notifications?: Notification[];
    onNotificationClick?: (n: Notification) => void;
    showWidgetEdit?: boolean;
    onWidgetEditToggle?: () => void;
}

export function Header({
    notifications = [],
    onNotificationClick,
    showWidgetEdit = false,
    onWidgetEditToggle,
}: HeaderProps) {
    const { setSidebarCollapsed, sidebarCollapsed, setSidebarOpen, isMobile } = useAppShell();
    const { user, isOwner, logout } = useAuth();

    const [notificationOpen, setNotificationOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);

    const notificationRef = useRef<HTMLDivElement>(null);
    const accountRef = useRef<HTMLDivElement>(null);

    // Close popups on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
                setNotificationOpen(false);
            }
            if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
                setAccountOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleMenuClick = () => {
        if (isMobile) {
            setSidebarOpen(true);
        } else {
            setSidebarCollapsed(!sidebarCollapsed);
        }
    };

    const getSeverityClass = (severity: number) => {
        if (severity >= 80) return 'critical';
        if (severity >= 60) return 'high';
        if (severity >= 40) return 'medium';
        return 'low';
    };

    const unreadCount = notifications.length;

    return (
        <>
            {/* Left Section */}
            <div className="header-left">
                <button className="header-icon-btn" onClick={handleMenuClick} aria-label="Toggle menu">
                    <MenuIcon />
                </button>
                <span className="header-logo">SENTENG</span>
            </div>

            {/* Center Section */}
            <div className="header-center">
                {/* Breadcrumbs or search could go here */}
            </div>

            {/* Right Section */}
            <div className="header-right">
                {/* Widget Edit (owner only) */}
                {showWidgetEdit && isOwner && (
                    <button
                        className={`header-icon-btn ${onWidgetEditToggle ? 'active' : ''}`}
                        onClick={onWidgetEditToggle}
                        aria-label="Edit widgets"
                    >
                        <SettingsIcon />
                    </button>
                )}

                {/* Notifications */}
                <div className="notification-badge" data-count={unreadCount > 99 ? '99+' : unreadCount} ref={notificationRef} style={{ position: 'relative' }}>
                    <button
                        className="header-icon-btn"
                        onClick={() => setNotificationOpen(!notificationOpen)}
                        aria-label="Notifications"
                    >
                        <BellIcon />
                    </button>

                    {notificationOpen && (
                        <div className="notification-popup">
                            <div className="notification-popup-header">
                                通知 ({unreadCount})
                            </div>
                            <div className="notification-popup-body">
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        目前沒有通知
                                    </div>
                                ) : (
                                    notifications.slice(0, 20).map(n => (
                                        <div
                                            key={n.id}
                                            className="notification-item"
                                            onClick={() => onNotificationClick?.(n)}
                                        >
                                            <div className="notification-item-title">
                                                <span className={`severity-badge ${getSeverityClass(n.severity)}`}>
                                                    {n.severity}
                                                </span>
                                                {n.title}
                                            </div>
                                            <div className="notification-item-time">
                                                {n.domain} • {new Date(n.ts).toLocaleString('zh-TW')}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Account */}
                <div ref={accountRef} style={{ position: 'relative' }}>
                    <button
                        className="header-icon-btn"
                        onClick={() => setAccountOpen(!accountOpen)}
                        aria-label="Account"
                    >
                        <UserIcon />
                    </button>

                    {accountOpen && (
                        <div className="dropdown-menu">
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ fontWeight: 500 }}>{user?.displayName || 'User'}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email}</div>
                            </div>
                            <a href="/settings" className="dropdown-item">
                                設定
                            </a>
                            <div className="dropdown-divider" />
                            <button
                                className="dropdown-item"
                                onClick={logout}
                                style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
                            >
                                登出
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default Header;
