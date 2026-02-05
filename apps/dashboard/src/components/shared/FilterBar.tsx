'use client';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Filter } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FilterOption {
    value: string;
    label: string;
}

interface FilterBarProps {
    searchValue: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    filters?: Array<{
        id: string;
        label: string;
        options: FilterOption[];
        value: string;
        onChange: (value: string) => void;
    }>;
    onClearAll?: () => void;
    className?: string;
}

export function FilterBar({
    searchValue,
    onSearchChange,
    searchPlaceholder = '搜尋...',
    filters = [],
    onClearAll,
    className,
}: FilterBarProps) {
    const hasActiveFilters = searchValue || filters.some((f) => f.value && f.value !== 'all');

    return (
        <div className={cn('flex flex-wrap items-center gap-3', className)}>
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="pl-9 pr-9"
                />
                {searchValue && (
                    <button
                        onClick={() => onSearchChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Filter Dropdowns */}
            {filters.map((filter) => (
                <DropdownMenu key={filter.id}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Filter className="h-3.5 w-3.5" />
                            {filter.label}
                            {filter.value && filter.value !== 'all' && (
                                <span className="text-primary font-medium">
                                    : {filter.options.find((o) => o.value === filter.value)?.label}
                                </span>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {filter.options.map((option) => (
                            <DropdownMenuItem
                                key={option.value}
                                onClick={() => filter.onChange(option.value)}
                                className={cn(
                                    filter.value === option.value && 'bg-accent'
                                )}
                            >
                                {option.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            ))}

            {/* Clear All Button */}
            {hasActiveFilters && onClearAll && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearAll}
                    className="text-muted-foreground"
                >
                    <X className="h-3.5 w-3.5 mr-1" />
                    清除篩選
                </Button>
            )}
        </div>
    );
}

export default FilterBar;
