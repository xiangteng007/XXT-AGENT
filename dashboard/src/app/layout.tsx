import { ReactNode } from 'react';
import { Providers } from './providers';
import '@/styles/globals.css';
import '@/styles/animations.css';

export const metadata = {
    title: 'LINE-Notion Dashboard',
    description: 'Admin dashboard for LINE to Notion multi-tenant platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="zh-TW">
            <body>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
