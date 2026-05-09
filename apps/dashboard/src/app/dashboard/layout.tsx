'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

/**
 * Dashboard Route Group Layout
 * 
 * Security fix: /dashboard/* pages were outside the (app) route group
 * and bypassed the AppLayoutClient auth guard.
 * This layout adds authentication enforcement.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, loading, isConfigured } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user && isConfigured) {
            router.push('/login');
        }
    }, [user, loading, router, isConfigured]);

    // Show loading while checking auth
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: '#0a0a0f',
                color: '#f0f0f5',
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #2a2a3a',
                    borderTopColor: '#6366f1',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }} />
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Block unauthenticated access when Firebase is configured
    if (!user && isConfigured) {
        return null;
    }

    return <>{children}</>;
}
