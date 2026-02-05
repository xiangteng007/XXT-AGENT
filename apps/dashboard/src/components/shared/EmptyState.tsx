'use client';

import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
    title?: string;
    description?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}

export function EmptyState({
    title = '沒有資料',
    description,
    icon,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-12 px-4 text-center',
                className
            )}
        >
            <div className="rounded-full bg-muted p-4 mb-4">
                {icon || <Inbox className="h-8 w-8 text-muted-foreground" />}
            </div>
            <h3 className="text-lg font-medium mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                    {description}
                </p>
            )}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

export default EmptyState;
