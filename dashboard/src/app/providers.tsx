'use client';

/**
 * Client-side providers wrapper for Next.js App Router
 * This component wraps all client-side context providers
 */

import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/AuthContext';

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    return (
        <AuthProvider>
            {children}
        </AuthProvider>
    );
}
