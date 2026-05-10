'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAppShell } from './AppShell';
import { useAuth } from '@/lib/AuthContext';
import { Menu, Bell, User, Settings } from 'lucide-react';

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
                    <Menu size={20} strokeWidth={1.5} />
                </button>
                <span className="header-logo">XXT</span>
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
                        <Settings size={20} strokeWidth={1.5} />
                    </button>
                )}

                {/* Notifications */}
                <div className="notification-badge" data-count={unreadCount > 99 ? '99+' : unreadCount} ref={notificationRef} style={{ position: 'relative' }}>
                    <button
                        className="header-icon-btn"
                        onClick={() => setNotificationOpen(!notificationOpen)}
                        aria-label="Notifications"
                    >
                        <Bell size={20} strokeWidth={1.5} />
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
                        <User size={20} strokeWidth={1.5} />
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
