'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ChartCardProps {
    title: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    icon?: ReactNode;
    chart?: ReactNode;
    footer?: ReactNode;
    className?: string;
    gradient?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

const gradientClasses = {
    blue: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900',
    green: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900',
    purple: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900',
    orange: 'from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900',
    red: 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900',
};

export function ChartCard({
    title,
    value,
    change,
    changeLabel,
    icon,
    chart,
    footer,
    className = '',
    gradient,
}: ChartCardProps) {
    const renderChange = () => {
        if (change === undefined) return null;

        const isPositive = change > 0;
        const isNegative = change < 0;
        const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
        const colorClass = isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-gray-400';

        return (
            <div className={`flex items-center gap-1 text-sm ${colorClass}`}>
                <Icon className="h-4 w-4" />
                <span>{isPositive ? '+' : ''}{change.toFixed(2)}%</span>
                {changeLabel && <span className="text-muted-foreground ml-1">{changeLabel}</span>}
            </div>
        );
    };

    return (
        <Card className={`${gradient ? `bg-gradient-to-br ${gradientClasses[gradient]}` : ''} ${className}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        {title}
                    </CardTitle>
                    {icon && <div className="text-muted-foreground">{icon}</div>}
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <div className="flex items-end justify-between">
                        <div className="text-2xl font-bold">{value}</div>
                        {renderChange()}
                    </div>
                    {chart && <div className="h-16">{chart}</div>}
                    {footer && <div className="text-xs text-muted-foreground pt-2">{footer}</div>}
                </div>
            </CardContent>
        </Card>
    );
}

// Mini sparkline component
interface SparklineProps {
    data: number[];
    color?: 'green' | 'red' | 'blue' | 'gray';
    height?: number;
}

export function Sparkline({ data, color = 'blue', height = 40 }: SparklineProps) {
    if (data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    const colorClasses = {
        green: 'stroke-green-500',
        red: 'stroke-red-500',
        blue: 'stroke-blue-500',
        gray: 'stroke-gray-400',
    };

    return (
        <svg width="100%" height={height} className="overflow-visible">
            <polyline
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={colorClasses[color]}
                points={points}
            />
        </svg>
    );
}

// Stats row component
interface StatsRowProps {
    items: Array<{
        label: string;
        value: string | number;
        change?: number;
    }>;
}

export function StatsRow({ items }: StatsRowProps) {
    return (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
            {items.map((item, idx) => (
                <div key={idx} className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-lg font-semibold">{item.value}</div>
                    {item.change !== undefined && (
                        <div className={`text-xs ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {item.change >= 0 ? '+' : ''}{item.change}%
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
