'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SeverityBadgeProps {
    severity: number;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

function getSeverityLevel(severity: number): 'critical' | 'high' | 'medium' | 'low' {
    if (severity >= 80) return 'critical';
    if (severity >= 60) return 'high';
    if (severity >= 40) return 'medium';
    return 'low';
}

function getSeverityLabel(level: 'critical' | 'high' | 'medium' | 'low'): string {
    const labels = {
        critical: '危急',
        high: '高',
        medium: '中',
        low: '低',
    };
    return labels[level];
}

const severityStyles = {
    critical: 'bg-red-500/20 text-red-500 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    medium: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    low: 'bg-green-500/20 text-green-500 border-green-500/30',
};

const sizeStyles = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
};

export function SeverityBadge({
    severity,
    showLabel = false,
    size = 'md',
    className,
}: SeverityBadgeProps) {
    const level = getSeverityLevel(severity);
    const label = getSeverityLabel(level);

    return (
        <Badge
            variant="outline"
            className={cn(
                'font-semibold border',
                severityStyles[level],
                sizeStyles[size],
                className
            )}
        >
            {severity}
            {showLabel && <span className="ml-1">{label}</span>}
        </Badge>
    );
}

export default SeverityBadge;
