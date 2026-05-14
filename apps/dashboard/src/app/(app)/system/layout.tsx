'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const tabs = [
    { href: '/system', label: '🩺 基礎設施', exact: true },
    { href: '/system/linebot', label: '💬 LINE Bot' },
    { href: '/system/telegram', label: '📨 Telegram Bot' },
];

export default function SystemLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 border-b border-border pb-0 overflow-x-auto">
                {tabs.map(tab => {
                    const isActive = tab.exact
                        ? pathname === tab.href
                        : pathname.startsWith(tab.href);
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`
                                px-4 py-2.5 text-sm font-medium whitespace-nowrap
                                border-b-2 transition-colors duration-150
                                ${isActive
                                    ? 'border-primary text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                                }
                            `}
                        >
                            {tab.label}
                        </Link>
                    );
                })}
            </div>

            {/* Tab Content */}
            {children}
        </div>
    );
}
