import { ReactNode } from 'react';
import { Providers } from './providers';
import '@/styles/globals.css';
import '@/styles/animations.css';

export const metadata = {
    title: 'XXT Personal Butler',
    description: '個人生活管理助理儀表板',
    manifest: '/manifest.json',
    themeColor: '#d4a574',
    appleWebApp: {
        capable: true,
        title: 'XXT Butler',
        statusBarStyle: 'black-translucent',
    },
    icons: {
        icon: '/favicon.svg',
    },
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
