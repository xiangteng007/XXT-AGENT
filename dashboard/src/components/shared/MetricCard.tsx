'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    icon?: React.ReactNode;
    className?: string;
}

export function MetricCard({
    title,
    value,
    subtitle,
    trend,
    trendValue,
    icon,
    className,
}: MetricCardProps) {
    const trendColors = {
        up: 'text-green-500',
        down: 'text-red-500',
        neutral: 'text-muted-foreground',
    };

    const TrendIcon = {
        up: ArrowUp,
        down: ArrowDown,
        neutral: Minus,
    };

    return (
        <Card className={cn('relative overflow-hidden', className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {icon && <div className="text-muted-foreground">{icon}</div>}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {(subtitle || trend) && (
                    <div className="flex items-center gap-2 mt-1">
                        {trend && trendValue && (() => {
                            const Icon = TrendIcon[trend];
                            return (
                                <span
                                    className={cn(
                                        'flex items-center text-xs font-medium',
                                        trendColors[trend]
                                    )}
                                >
                                    <Icon className="h-3 w-3 mr-0.5" />
                                    {trendValue}
                                </span>
                            );
                        })()}
                        {subtitle && (
                            <span className="text-xs text-muted-foreground">{subtitle}</span>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default MetricCard;
