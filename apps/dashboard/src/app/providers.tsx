'use client';

/**
 * Client-side providers wrapper for Next.js App Router
 * This component wraps all client-side context providers
 */

import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/AuthContext';
import { RBACProvider } from '@/contexts/RBACContext';

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    return (
        <AuthProvider>
            <RBACProvider>
                {children}
            </RBACProvider>
        </AuthProvider>
    );
}
