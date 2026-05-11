'use client';

/**
 * Client-side providers wrapper for Next.js App Router
 * This component wraps all client-side context providers
 */

import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/AuthContext';
import { RBACProvider } from '@/contexts/RBACContext';
import { I18nProvider } from '@/lib/i18n';

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    return (
        <AuthProvider>
            <RBACProvider>
                <I18nProvider>
                    {children}
                </I18nProvider>
            </RBACProvider>
        </AuthProvider>
    );
}

