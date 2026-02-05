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
        <Card className={cn(
            'relative overflow-hidden card-glow card-lift cursor-pointer',
            'bg-card/50 backdrop-blur-sm border-border/50',
            'hover:border-gold/30 transition-all duration-300',
            className
        )}>
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.03] via-transparent to-transparent pointer-events-none" />
            
            <CardHeader className="relative z-10 pb-3">
                {/* Icon Badge */}
                {icon && (
                    <div className="p-2.5 w-fit rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/20 mb-3">
                        <div className="text-gold">{icon}</div>
                    </div>
                )}
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
                {/* Large Value with Outfit Font */}
                <div className="text-4xl font-bold tracking-tight tabular-nums" style={{ fontFamily: 'Outfit, Inter, sans-serif' }}>
                    {value}
                </div>
                {(subtitle || trend) && (
                    <div className="flex items-center gap-2 mt-2">
                        {trend && trendValue && (() => {
                            const Icon = TrendIcon[trend];
                            return (
                                <span className={cn(
                                    'flex items-center text-xs font-semibold px-1.5 py-0.5 rounded',
                                    trend === 'up' && 'text-emerald-400 bg-emerald-500/10',
                                    trend === 'down' && 'text-red-400 bg-red-500/10',
                                    trend === 'neutral' && 'text-muted-foreground bg-muted/50'
                                )}>
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
