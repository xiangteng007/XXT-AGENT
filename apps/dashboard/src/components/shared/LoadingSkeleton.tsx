'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingSkeletonProps {
    type?: 'card' | 'table' | 'list' | 'text';
    count?: number;
    className?: string;
}

export function LoadingSkeleton({
    type = 'card',
    count = 3,
    className,
}: LoadingSkeletonProps) {
    if (type === 'card') {
        return (
            <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', className)}>
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="rounded-lg border p-6 space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'table') {
        return (
            <div className={cn('rounded-md border', className)}>
                <div className="p-4 border-b">
                    <Skeleton className="h-4 w-full" />
                </div>
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="p-4 border-b last:border-0 flex gap-4">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-12" />
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'list') {
        return (
            <div className={cn('space-y-4', className)}>
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-lg border">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // text
    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
            ))}
        </div>
    );
}

export default LoadingSkeleton;
