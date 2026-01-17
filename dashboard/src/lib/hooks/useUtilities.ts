'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions<T> {
    /** Initial items to display */
    items: T[];
    /** Number of items to load per batch */
    batchSize?: number;
    /** Intersection observer threshold */
    threshold?: number;
    /** Root margin for intersection observer */
    rootMargin?: string;
}

interface UseInfiniteScrollResult<T> {
    /** Currently visible items */
    visibleItems: T[];
    /** Ref to attach to loader element */
    loaderRef: React.RefObject<HTMLDivElement>;
    /** Whether all items have been loaded */
    isComplete: boolean;
    /** Current count of visible items */
    visibleCount: number;
    /** Total count of items */
    totalCount: number;
    /** Reset to initial state */
    reset: () => void;
    /** Load more items manually */
    loadMore: () => void;
}

export function useInfiniteScroll<T>({
    items,
    batchSize = 20,
    threshold = 0.1,
    rootMargin = '100px',
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollResult<T> {
    const [visibleCount, setVisibleCount] = useState(batchSize);
    const loaderRef = useRef<HTMLDivElement>(null);

    const loadMore = useCallback(() => {
        setVisibleCount(prev => Math.min(prev + batchSize, items.length));
    }, [batchSize, items.length]);

    const reset = useCallback(() => {
        setVisibleCount(batchSize);
    }, [batchSize]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < items.length) {
                    loadMore();
                }
            },
            { threshold, rootMargin }
        );

        const currentLoader = loaderRef.current;
        if (currentLoader) {
            observer.observe(currentLoader);
        }

        return () => {
            if (currentLoader) {
                observer.unobserve(currentLoader);
            }
            observer.disconnect();
        };
    }, [visibleCount, items.length, loadMore, threshold, rootMargin]);

    // Reset when items change significantly
    useEffect(() => {
        if (items.length < visibleCount) {
            setVisibleCount(Math.min(batchSize, items.length || batchSize));
        }
    }, [items.length, visibleCount, batchSize]);

    return {
        visibleItems: items.slice(0, visibleCount),
        loaderRef,
        isComplete: visibleCount >= items.length,
        visibleCount,
        totalCount: items.length,
        reset,
        loadMore,
    };
}

// Debounce hook for search inputs
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}

// Local storage hook with SSR safety
export function useLocalStorage<T>(
    key: string,
    initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') return initialValue;

        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    const setValue = useCallback((value: T | ((prev: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);

            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    return [storedValue, setValue];
}

// Previous value hook for comparisons
export function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T>();

    useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref.current;
}
