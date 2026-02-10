'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppShell } from './AppShell';

/* ================================
   SVG Icons
   ================================ */
const HomeIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

const SparklesIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l1.09 3.26L16 8l-2.91 1.74L12 13l-1.09-3.26L8 8l2.91-1.74L12 3z" />
        <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" />
        <path d="M19 8l.5 1.5L21 10l-1.5.5L19 12l-.5-1.5L17 10l1.5-.5L19 8z" />
    </svg>
);

const TrendingIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
    </svg>
);

const GlobeIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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

const MarketIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
);

const ChartIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
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

const BellIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

const WalletIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
);

const HeartIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

const CarIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
        <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
        <path d="M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2" />
        <line x1="9" y1="17" x2="15" y2="17" />
        <path d="M5 6l9 0" />
    </svg>
);

const CalendarIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

const ChatIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

const ShieldIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const SettingsIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg
        className="icon chevron-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{
            width: 14, height: 14,
            transition: 'transform 200ms ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
    >
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

const CloseIcon = () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

/* ================================
   Types
   ================================ */
interface NavChild {
    href: string;
    label: string;
}

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
    children?: NavChild[];
}

/* ================================
   Navigation Config
   ================================ */
const mainNav: NavItem[] = [
    { href: '/', label: '總覽', icon: <HomeIcon /> },
    {
        href: '/butler', label: '個人管家', icon: <SparklesIcon />,
        children: [
            { href: '/butler', label: '管家總覽' },
            { href: '/butler/finance', label: '💰 財務管理' },
            { href: '/butler/calendar', label: '📅 行事曆' },
            { href: '/butler/health', label: '🏃 健康追蹤' },
            { href: '/butler/vehicle', label: '🚗 車輛管理' },
            { href: '/butler/chat', label: '💬 AI 對話' },
            { href: '/butler/admin', label: '⚙️ 管家設定' },
        ],
    },
    { href: '/portfolio', label: '投資組合', icon: <TrendingIcon /> },
    {
        href: '/market', label: '市場監控', icon: <MarketIcon />,
        children: [
            { href: '/market', label: '市場總覽' },
            { href: '/market/quotes', label: '📈 即時報價' },
            { href: '/market/watchlist', label: '⭐ 自選清單' },
            { href: '/market/heatmap', label: '🗺️ 熱力圖' },
            { href: '/market/signals', label: '📡 交易信號' },
            { href: '/market/indicators', label: '📊 技術指標' },
            { href: '/market/alerts', label: '🔔 價格警報' },
            { href: '/market/news', label: '📰 市場新聞' },
        ],
    },
    {
        href: '/news', label: '新聞監控', icon: <LogIcon />,
        children: [
            { href: '/news', label: '新聞總覽' },
            { href: '/news/feed', label: '📰 新聞動態' },
            { href: '/news/analysis', label: '🔍 新聞分析' },
            { href: '/news/sources', label: '📡 來源管理' },
            { href: '/news/alerts', label: '🔔 新聞警報' },
        ],
    },
    {
        href: '/social', label: '社群監控', icon: <GlobeIcon />,
        children: [
            { href: '/social', label: '社群總覽' },
            { href: '/social/feed', label: '📱 社群動態' },
            { href: '/social/sentiment', label: '💬 情緒分析' },
            { href: '/social/analytics', label: '📊 數據分析' },
            { href: '/social/accounts', label: '👤 帳號管理' },
            { href: '/social/reports', label: '📋 報告' },
            { href: '/social/settings', label: '⚙️ 設定' },
        ],
    },
    { href: '/events', label: '融合事件', icon: <TrendingIcon /> },
    {
        href: '/ai', label: 'AI 助理', icon: <SparklesIcon />,
        children: [
            { href: '/ai', label: 'AI 總覽' },
            { href: '/ai/analysis', label: '🧠 AI 分析' },
        ],
    },
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
    {
        href: '/settings', label: '設定', icon: <SettingsIcon />,
        children: [
            { href: '/settings', label: '一般設定' },
            { href: '/settings/link-telegram', label: '🔗 Telegram 綁定' },
        ],
    },
];

/* ================================
   NavGroup Component (Expandable)
   ================================ */
function NavGroup({ item, pathname, collapsed, onMobileClose }: {
    item: NavItem;
    pathname: string;
    collapsed: boolean;
    onMobileClose: () => void;
}) {
    const hasChildren = item.children && item.children.length > 0;
    const isParentActive = pathname === item.href || !!(hasChildren && pathname.startsWith(item.href) && item.href !== '/');
    const [expanded, setExpanded] = useState<boolean>(isParentActive);

    const handleToggle = useCallback((e: React.MouseEvent) => {
        if (hasChildren && !collapsed) {
            e.preventDefault();
            setExpanded(prev => !prev);
        }
    }, [hasChildren, collapsed]);

    // Simple nav item (no children)
    if (!hasChildren) {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
            <Link
                href={item.href}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={onMobileClose}
            >
                {item.icon}
                {!collapsed && <span className="label">{item.label}</span>}
            </Link>
        );
    }

    // Expandable group
    return (
        <div className="sidebar-nav-group">
            <button
                className={`sidebar-nav-item sidebar-nav-parent ${isParentActive ? 'active' : ''}`}
                onClick={handleToggle}
                type="button"
            >
                {item.icon}
                {!collapsed && (
                    <>
                        <span className="label">{item.label}</span>
                        <span className="sidebar-chevron">
                            <ChevronIcon expanded={expanded} />
                        </span>
                    </>
                )}
            </button>

            {!collapsed && (
                <div
                    className="sidebar-sub-menu"
                    style={{
                        maxHeight: expanded ? `${(item.children!.length) * 40 + 8}px` : '0px',
                        opacity: expanded ? 1 : 0,
                        overflow: 'hidden',
                        transition: 'max-height 250ms ease, opacity 200ms ease',
                    }}
                >
                    {item.children!.map(child => {
                        const isChildActive = child.href === item.href
                            ? pathname === child.href
                            : pathname === child.href;
                        return (
                            <Link
                                key={child.href}
                                href={child.href}
                                className={`sidebar-sub-item ${isChildActive ? 'active' : ''}`}
                                onClick={onMobileClose}
                            >
                                {child.label}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ================================
   Sidebar Component
   ================================ */
export function Sidebar() {
    const pathname = usePathname();
    const { sidebarCollapsed, setSidebarOpen, isMobile } = useAppShell();

    const handleMobileClose = useCallback(() => {
        if (isMobile) setSidebarOpen(false);
    }, [isMobile, setSidebarOpen]);

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
                    <NavGroup
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        collapsed={sidebarCollapsed}
                        onMobileClose={handleMobileClose}
                    />
                ))}

                {/* Admin Section */}
                {!sidebarCollapsed && (
                    <div className="sidebar-section-title">管理</div>
                )}
                {adminNav.map(item => (
                    <NavGroup
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        collapsed={sidebarCollapsed}
                        onMobileClose={handleMobileClose}
                    />
                ))}

                {/* Settings Section */}
                {!sidebarCollapsed && (
                    <div className="sidebar-section-title">系統</div>
                )}
                {settingsNav.map(item => (
                    <NavGroup
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        collapsed={sidebarCollapsed}
                        onMobileClose={handleMobileClose}
                    />
                ))}
            </nav>
        </>
    );
}

export default Sidebar;
