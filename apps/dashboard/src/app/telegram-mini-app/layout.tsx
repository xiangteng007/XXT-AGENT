import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
    title: 'XXT Butler - Telegram Mini App',
    description: 'Your personal butler dashboard in Telegram',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function TelegramMiniAppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="zh-TW">
            <head>
                <script src="https://telegram.org/js/telegram-web-app.js" async />
            </head>
            <body className="bg-background">
                {children}
            </body>
        </html>
    );
}
