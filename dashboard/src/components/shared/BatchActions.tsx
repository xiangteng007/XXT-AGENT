'use client';

import { useState, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface BatchActionsProps<T extends { id: string }> {
    items: T[];
    selectedIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
    actions: BatchAction[];
    children?: ReactNode;
}

interface BatchAction {
    label: string;
    icon?: ReactNode;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    onClick: (selectedIds: string[]) => void | Promise<void>;
    disabled?: boolean;
}

/**
 * Hook for managing batch selection state
 */
export function useBatchSelection<T extends { id: string }>(items: T[]) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const selectAll = () => {
        setSelectedIds(new Set(items.map(item => item.id)));
    };

    const selectNone = () => {
        setSelectedIds(new Set());
    };

    const toggleItem = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const isSelected = (id: string) => selectedIds.has(id);
    const isAllSelected = items.length > 0 && selectedIds.size === items.length;
    const isSomeSelected = selectedIds.size > 0 && selectedIds.size < items.length;
    const selectedCount = selectedIds.size;

    return {
        selectedIds,
        setSelectedIds,
        selectAll,
        selectNone,
        toggleItem,
        isSelected,
        isAllSelected,
        isSomeSelected,
        selectedCount,
    };
}

/**
 * Batch actions toolbar component
 */
export function BatchActionsBar<T extends { id: string }>({
    items,
    selectedIds,
    onSelectionChange,
    actions,
    children,
}: BatchActionsProps<T>) {
    const [loading, setLoading] = useState<string | null>(null);

    const selectedCount = selectedIds.size;
    const isAllSelected = items.length > 0 && selectedCount === items.length;

    const handleSelectAll = () => {
        if (isAllSelected) {
            onSelectionChange(new Set());
        } else {
            onSelectionChange(new Set(items.map(item => item.id)));
        }
    };

    const handleAction = async (action: BatchAction) => {
        if (selectedCount === 0) return;

        setLoading(action.label);
        try {
            await action.onClick(Array.from(selectedIds));
            onSelectionChange(new Set());
        } finally {
            setLoading(null);
        }
    };

    if (selectedCount === 0 && !children) {
        return null;
    }

    return (
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg mb-4">
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    aria-label="選擇全部"
                    className="h-4 w-4 rounded border-border bg-muted accent-primary"
                />
                <span className="text-sm text-muted-foreground">
                    {selectedCount > 0
                        ? `已選擇 ${selectedCount} 項`
                        : `共 ${items.length} 項`
                    }
                </span>
            </div>

            {selectedCount > 0 && (
                <div className="flex items-center gap-2 border-l border-border pl-4">
                    {actions.map(action => (
                        <Button
                            key={action.label}
                            variant={action.variant || 'outline'}
                            size="sm"
                            onClick={() => handleAction(action)}
                            disabled={action.disabled || loading !== null}
                        >
                            {loading === action.label ? (
                                <span className="animate-spin mr-1">⏳</span>
                            ) : action.icon ? (
                                <span className="mr-1">{action.icon}</span>
                            ) : null}
                            {action.label}
                        </Button>
                    ))}
                </div>
            )}

            {children}
        </div>
    );
}

/**
 * Checkbox cell for table rows
 */
export function BatchCheckbox({
    checked,
    onCheckedChange,
    id,
}: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    id: string;
}) {
    return (
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            aria-label={`選擇項目 ${id}`}
            className="h-4 w-4 rounded border-border bg-muted accent-primary"
        />
    );
}
