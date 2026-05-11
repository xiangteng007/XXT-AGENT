import { ReactNode, Suspense } from 'react';
import { Providers } from './providers';
import { ErrorBoundary, SuspenseFallback, OfflineIndicator } from '@/components/shared/ErrorBoundary';
import '@/styles/globals.css';
import '@/styles/animations.css';

export const metadata = {
    title: {
        default: 'XXT Personal Butler',
        template: '%s | XXT Dashboard',
    },
    description: 'XXT 個人生活管理助理 — AI 驅動的全方位智慧儀表板',
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
    openGraph: {
        title: 'XXT Dashboard',
        description: 'AI 驅動的個人管家 — 管理市場、新聞、社群、財務',
        type: 'website',
    },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="zh-TW">
            <body>
                <Providers>
                    {/* F-01: 根層級 Error Boundary — 防止白屏 */}
                    <ErrorBoundary name="RootLayout">
                        {/* Suspense — 處理 async Server Components 的 loading 狀態 */}
                        <Suspense fallback={<SuspenseFallback message="載入儀表板..." />}>
                            {children}
                        </Suspense>
                    </ErrorBoundary>
                    {/* 離線偵測提示 */}
                    <OfflineIndicator />
                </Providers>
            </body>
        </html>
    );
}
