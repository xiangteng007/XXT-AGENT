'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import '@/styles/appshell.css';

// ================================
// AppShell Context
// ================================
interface AppShellContextValue {
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (v: boolean) => void;
    sidebarOpen: boolean; // Mobile overlay
    setSidebarOpen: (v: boolean) => void;
    isMobile: boolean;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
    const ctx = useContext(AppShellContext);
    if (!ctx) throw new Error('useAppShell must be used within AppShellProvider');
    return ctx;
}

// ================================
// AppShell Provider
// ================================
interface AppShellProviderProps {
    children: React.ReactNode;
}

export function AppShellProvider({ children }: AppShellProviderProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 900);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Load sidebar state from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        if (saved !== null) setSidebarCollapsed(saved === 'true');
    }, []);

    // Save sidebar state
    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
    }, [sidebarCollapsed]);

    return (
        <AppShellContext.Provider value={{
            sidebarCollapsed,
            setSidebarCollapsed,
            sidebarOpen,
            setSidebarOpen,
            isMobile,
        }}>
            {children}
        </AppShellContext.Provider>
    );
}

// ================================
// AppShell Component
// ================================
interface AppShellProps {
    children: React.ReactNode;
    header: React.ReactNode;
    sidebar: React.ReactNode;
    mobileBottom?: React.ReactNode;
}

export function AppShell({ children, header, sidebar, mobileBottom }: AppShellProps) {
    const { sidebarCollapsed, sidebarOpen, isMobile } = useAppShell();

    const mainClass = [
        'appshell-main',
        isMobile ? 'sidebar-hidden' : (sidebarCollapsed ? 'sidebar-collapsed' : ''),
    ].filter(Boolean).join(' ');

    const sidebarClass = [
        'appshell-sidebar',
        sidebarCollapsed ? 'collapsed' : '',
        isMobile && !sidebarOpen ? 'hidden' : '',
        isMobile && sidebarOpen ? 'mobile-open' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className="appshell">
            <header className="appshell-header">
                {header}
            </header>

            <div className="appshell-body">
                <aside className={sidebarClass}>
                    {sidebar}
                </aside>

                <main className={mainClass}>
                    {children}
                </main>
            </div>

            {isMobile && mobileBottom && (
                <nav className="appshell-mobile-bottom">
                    {mobileBottom}
                </nav>
            )}
        </div>
    );
}

export default AppShell;
