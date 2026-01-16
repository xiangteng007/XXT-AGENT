'use client';

import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ArrowUp, ArrowDown } from 'lucide-react';

export interface Column<T> {
    key: string;
    header: string;
    sortable?: boolean;
    className?: string;
    render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    sortKey?: string;
    sortOrder?: 'asc' | 'desc';
    onSort?: (key: string) => void;
    onRowClick?: (item: T) => void;
    rowClassName?: (item: T) => string | undefined;
    emptyMessage?: string;
    compact?: boolean;
    className?: string;
}

export function DataTable<T extends object>({
    data,
    columns,
    sortKey,
    sortOrder,
    onSort,
    onRowClick,
    rowClassName,
    emptyMessage = '沒有資料',
    compact = false,
    className,
}: DataTableProps<T>) {
    const handleSort = (key: string, sortable?: boolean) => {
        if (sortable && onSort) {
            onSort(key);
        }
    };

    return (
        <div className={cn('rounded-md border', className)}>
            <Table>
                <TableHeader>
                    <TableRow>
                        {columns.map((column) => (
                            <TableHead
                                key={column.key}
                                className={cn(
                                    column.sortable && 'cursor-pointer select-none hover:bg-muted/50',
                                    column.className,
                                    compact && 'py-2'
                                )}
                                onClick={() => handleSort(column.key, column.sortable)}
                            >
                                <div className="flex items-center gap-1">
                                    {column.header}
                                    {column.sortable && sortKey === column.key && (
                                        sortOrder === 'asc' ? (
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        ) : (
                                            <ArrowDown className="h-3.5 w-3.5" />
                                        )
                                    )}
                                </div>
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center text-muted-foreground"
                            >
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((item, index) => (
                            <TableRow
                                key={('id' in item ? String(item.id) : undefined) ?? index}
                                onClick={() => onRowClick?.(item)}
                                className={cn(
                                    onRowClick && 'cursor-pointer',
                                    rowClassName?.(item)
                                )}
                            >
                                {columns.map((column) => (
                                    <TableCell
                                        key={column.key}
                                        className={cn(column.className, compact && 'py-2')}
                                    >
                                        {column.render
                                            ? column.render(item)
                                            : ((item as Record<string, unknown>)[column.key] as React.ReactNode)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

export default DataTable;
