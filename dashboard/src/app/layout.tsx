import { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth-context';
import '@/styles/globals.css';

export const metadata = {
    title: 'LINE-Notion Dashboard',
    description: 'Admin dashboard for LINE to Notion multi-tenant platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="zh-TW">
            <body>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
