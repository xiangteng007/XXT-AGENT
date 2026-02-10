'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppShell } from './AppShell';

// Navigation Icons
const HomeIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

const UsersIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const RulesIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
);

const MapIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
);

const ListIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
);

const LogIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

const ChartIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
);

const GlobeIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

const TrendingIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
    </svg>
);

const TagIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
);

const BellIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

const MarketIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
);

const SparklesIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l1.09 3.26L16 8l-2.91 1.74L12 13l-1.09-3.26L8 8l2.91-1.74L12 3z" />
        <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" />
        <path d="M19 8l.5 1.5L21 10l-1.5.5L19 12l-.5-1.5L17 10l1.5-.5L19 8z" />
    </svg>
);

const CloseIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

const mainNav: NavItem[] = [
    { href: '/', label: '總覽', icon: <HomeIcon /> },
    { href: '/butler', label: '個人管家', icon: <SparklesIcon /> },
    { href: '/events', label: '融合事件', icon: <TrendingIcon /> },
    { href: '/social', label: '社群監控', icon: <GlobeIcon /> },
    { href: '/news', label: '新聞監控', icon: <LogIcon /> },
    { href: '/market', label: '市場監控', icon: <MarketIcon /> },
    { href: '/portfolio', label: '投資組合', icon: <TrendingIcon /> },
    { href: '/ai', label: 'AI 助理', icon: <GlobeIcon /> },
];

const adminNav: NavItem[] = [
    { href: '/tenants', label: '租戶管理', icon: <UsersIcon /> },
    { href: '/team/members', label: '團隊成員', icon: <UsersIcon /> },
    { href: '/rules', label: '規則設定', icon: <RulesIcon /> },
    { href: '/mappings', label: '關鍵字對應', icon: <MapIcon /> },
    { href: '/jobs', label: '排程任務', icon: <ListIcon /> },
    { href: '/logs', label: '系統日誌', icon: <LogIcon /> },
    { href: '/metrics', label: '系統指標', icon: <ChartIcon /> },
    { href: '/system', label: '系統健康', icon: <BellIcon /> },
];

const settingsNav: NavItem[] = [
    { href: '/settings', label: '設定', icon: <RulesIcon /> },
];

export function Sidebar() {
    const pathname = usePathname();
    const { sidebarCollapsed, setSidebarOpen, isMobile } = useAppShell();

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <>
            {/* Mobile Close Button */}
            {isMobile && (
                <div className="sidebar-header flex justify-end">
                    <button
                        className="header-icon-btn"
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close sidebar"
                    >
                        <CloseIcon />
                    </button>
                </div>
            )}

            <nav className="sidebar-nav">
                {/* Main Navigation */}
                {mainNav.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-nav-item ${isActive(item.href) ? 'active' : ''}`}
                        onClick={() => isMobile && setSidebarOpen(false)}
                    >
                        {item.icon}
                        {!sidebarCollapsed && <span className="label">{item.label}</span>}
                    </Link>
                ))}

                {/* Admin Section */}
                {!sidebarCollapsed && (
                    <div className="sidebar-section-title">管理</div>
                )}
                {adminNav.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-nav-item ${isActive(item.href) ? 'active' : ''}`}
                        onClick={() => isMobile && setSidebarOpen(false)}
                    >
                        {item.icon}
                        {!sidebarCollapsed && <span className="label">{item.label}</span>}
                    </Link>
                ))}

                {/* Settings Section */}
                {!sidebarCollapsed && (
                    <div className="sidebar-section-title">系統</div>
                )}
                {settingsNav.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-nav-item ${isActive(item.href) ? 'active' : ''}`}
                        onClick={() => isMobile && setSidebarOpen(false)}
                    >
                        {item.icon}
                        {!sidebarCollapsed && <span className="label">{item.label}</span>}
                    </Link>
                ))}
            </nav>
        </>
    );
}

export default Sidebar;
