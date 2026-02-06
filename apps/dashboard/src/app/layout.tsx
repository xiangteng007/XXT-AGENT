import { ReactNode } from 'react';
import { Providers } from './providers';
import '@/styles/globals.css';
import '@/styles/animations.css';

export const metadata = {
    title: 'XXT Personal Butler',
    description: '個人生活管理助理儀表板',
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
