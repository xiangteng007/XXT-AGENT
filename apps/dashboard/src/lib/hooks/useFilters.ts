'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export type FilterValue = string | string[] | undefined;
export type Filters = Record<string, FilterValue>;

interface UseFiltersOptions {
    /** Default values for filters */
    defaults?: Filters;
    /** Debounce delay for URL updates (ms) */
    debounceMs?: number;
}

/**
 * Hook for managing filters with URL query string synchronization
 * Supports both single values and arrays
 */
export function useFilters<T extends Filters>(options: UseFiltersOptions = {}) {
    const { defaults = {} } = options;
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Parse current filters from URL
    const filters = useMemo(() => {
        const result: Filters = { ...defaults };

        searchParams.forEach((value, key) => {
            const existingValue = result[key];
            if (Array.isArray(existingValue)) {
                result[key] = [...existingValue, value];
            } else if (existingValue !== undefined) {
                result[key] = [existingValue, value];
            } else {
                result[key] = value;
            }
        });

        return result as T;
    }, [searchParams, defaults]);

    // Update a single filter
    const setFilter = useCallback((key: string, value: FilterValue) => {
        const params = new URLSearchParams(searchParams.toString());

        // Remove existing values for this key
        params.delete(key);

        if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
            // Remove filter if empty
        } else if (Array.isArray(value)) {
            // Add array values
            value.forEach(v => params.append(key, v));
        } else {
            // Add single value
            params.set(key, value);
        }

        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    // Update multiple filters at once
    const setFilters = useCallback((newFilters: Partial<T>) => {
        const params = new URLSearchParams(searchParams.toString());

        Object.entries(newFilters).forEach(([key, value]) => {
            params.delete(key);

            if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
                // Remove filter
            } else if (Array.isArray(value)) {
                (value as string[]).forEach(v => params.append(key, v));
            } else {
                params.set(key, value as string);
            }
        });

        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    // Reset all filters to defaults
    const resetFilters = useCallback(() => {
        const params = new URLSearchParams();

        Object.entries(defaults).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                if (Array.isArray(value)) {
                    value.forEach(v => params.append(key, v));
                } else {
                    params.set(key, value);
                }
            }
        });

        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, [defaults, router, pathname]);

    // Check if filters have changed from defaults
    const hasActiveFilters = useMemo(() => {
        const currentKeys = Array.from(searchParams.keys());
        const defaultKeys = Object.keys(defaults);

        // Check if any non-default filters exist
        return currentKeys.some(key => {
            const currentValue = searchParams.get(key);
            const defaultValue = defaults[key];
            return currentValue !== defaultValue;
        });
    }, [searchParams, defaults]);

    return {
        filters,
        setFilter,
        setFilters,
        resetFilters,
        hasActiveFilters,
    };
}
