'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Filter, X, Search, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

export interface FilterOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

export interface FilterConfig {
    key: string;
    label: string;
    type: 'select' | 'multi-select' | 'date-range' | 'search';
    options?: FilterOption[];
    placeholder?: string;
}

interface AdvancedFiltersProps {
    configs: FilterConfig[];
    values: Record<string, string | string[]>;
    onChange: (key: string, value: string | string[]) => void;
    onClear: () => void;
    totalCount: number;
    filteredCount: number;
}

/**
 * Advanced Filters component for monitoring systems
 * Supports multi-select, date ranges, and search
 */
export function AdvancedFilters({
    configs,
    values,
    onChange,
    onClear,
    totalCount,
    filteredCount,
}: AdvancedFiltersProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const activeFilterCount = Object.values(values).filter(v =>
        Array.isArray(v) ? v.length > 0 : v && v !== 'all'
    ).length;

    const handleMultiSelect = (key: string, value: string) => {
        const current = (values[key] as string[]) || [];
        if (current.includes(value)) {
            onChange(key, current.filter(v => v !== value));
        } else {
            onChange(key, [...current, value]);
        }
    };

    return (
        <div className="space-y-3">
            {/* Filter Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                >
                    <Filter className="h-4 w-4" />
                    進階篩選
                    {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="ml-1">
                            {activeFilterCount}
                        </Badge>
                    )}
                    {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                    ) : (
                        <ChevronDown className="h-4 w-4" />
                    )}
                </button>
                <div className="text-xs text-muted-foreground">
                    顯示 {filteredCount} / {totalCount} 筆
                </div>
            </div>

            {/* Filter Panel */}
            {isExpanded && (
                <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {configs.map(config => (
                            <div key={config.key} className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">
                                    {config.label}
                                </label>

                                {config.type === 'select' && config.options && (
                                    <Select
                                        value={(values[config.key] as string) || 'all'}
                                        onValueChange={(v) => onChange(config.key, v)}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder={config.placeholder || '全部'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">全部</SelectItem>
                                            {config.options.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    <span className="flex items-center gap-2">
                                                        {opt.icon}
                                                        {opt.label}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {config.type === 'multi-select' && config.options && (
                                    <div className="flex flex-wrap gap-1">
                                        {config.options.map(opt => {
                                            const selected = ((values[config.key] as string[]) || []).includes(opt.value);
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => handleMultiSelect(config.key, opt.value)}
                                                    className={`px-2 py-1 text-xs rounded-full border transition-all ${selected
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'bg-background hover:border-primary/50'
                                                        }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {config.type === 'search' && (
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            value={(values[config.key] as string) || ''}
                                            onChange={(e) => onChange(config.key, e.target.value)}
                                            placeholder={config.placeholder}
                                            className="h-9 pl-8 text-sm"
                                        />
                                    </div>
                                )}

                                {config.type === 'date-range' && (
                                    <div className="flex gap-2">
                                        <Input
                                            type="date"
                                            value={(values[`${config.key}_start`] as string) || ''}
                                            onChange={(e) => onChange(`${config.key}_start`, e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                        <Input
                                            type="date"
                                            value={(values[`${config.key}_end`] as string) || ''}
                                            onChange={(e) => onChange(`${config.key}_end`, e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Active Filters & Clear */}
                    {activeFilterCount > 0 && (
                        <div className="flex items-center justify-between pt-2 border-t">
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(values).map(([key, value]) => {
                                    if (!value || (Array.isArray(value) && value.length === 0) || value === 'all') return null;
                                    const config = configs.find(c => c.key === key);
                                    if (!config) return null;

                                    if (Array.isArray(value)) {
                                        return value.map(v => {
                                            const opt = config.options?.find(o => o.value === v);
                                            return (
                                                <Badge key={`${key}-${v}`} variant="secondary" className="gap-1">
                                                    {opt?.label || v}
                                                    <button onClick={() => handleMultiSelect(key, v)} aria-label={`移除篩選 ${opt?.label || v}`}>
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            );
                                        });
                                    }

                                    const opt = config.options?.find(o => o.value === value);
                                    return (
                                        <Badge key={key} variant="secondary" className="gap-1">
                                            {config.label}: {opt?.label || value}
                                            <button onClick={() => onChange(key, config.type === 'multi-select' ? [] : '')} aria-label={`移除篩選 ${config.label}`}>
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    );
                                })}
                            </div>
                            <Button variant="ghost" size="sm" onClick={onClear}>
                                <X className="h-4 w-4 mr-1" />
                                清除全部
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Quick filter pills for common filters
 */
export function QuickFilters({
    options,
    selected,
    onChange,
}: {
    options: FilterOption[];
    selected: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2">
            <button
                onClick={() => onChange('all')}
                className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-all ${selected === 'all'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:border-primary/50'
                    }`}
            >
                全部
            </button>
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-all flex items-center gap-1.5 ${selected === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:border-primary/50'
                        }`}
                >
                    {opt.icon}
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
