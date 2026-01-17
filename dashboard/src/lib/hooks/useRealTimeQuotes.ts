'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface RealTimeQuote {
    symbol: string;
    price: number;
    change: number;
    changePct: number;
    volume: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    timestamp: number;
    source: 'websocket' | 'polling' | 'cache';
}

interface UseRealTimeQuotesOptions {
    /** Polling interval in ms (default: 30000 for 30s) */
    pollingInterval?: number;
    /** Whether to enable real-time updates */
    enabled?: boolean;
    /** Fallback to polling if WebSocket unavailable */
    fallbackToPolling?: boolean;
}

const DEFAULT_OPTIONS: UseRealTimeQuotesOptions = {
    pollingInterval: 30000,
    enabled: true,
    fallbackToPolling: true,
};

/**
 * Real-time quotes hook with WebSocket support and fallback to polling
 */
export function useRealTimeQuotes(
    symbols: string[],
    options: UseRealTimeQuotesOptions = {}
) {
    const { pollingInterval, enabled, fallbackToPolling } = { ...DEFAULT_OPTIONS, ...options };
    const [quotes, setQuotes] = useState<Map<string, RealTimeQuote>>(new Map());
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'polling'>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

    // Fallback polling with SWR
    const { data: polledData, mutate } = useSWR(
        enabled && connectionStatus === 'polling' && symbols.length > 0
            ? [ENDPOINTS.MARKET_QUOTES, symbols.join(',')]
            : null,
        async () => {
            const response = await fetch(`${ENDPOINTS.MARKET_QUOTES}?symbols=${symbols.join(',')}`);
            if (!response.ok) throw new Error('Failed to fetch quotes');
            return response.json();
        },
        {
            refreshInterval: pollingInterval,
            revalidateOnFocus: false,
        }
    );

    // Update quotes from polling data
    useEffect(() => {
        if (polledData?.quotes) {
            const newQuotes = new Map(quotes);
            polledData.quotes.forEach((q: RealTimeQuote) => {
                newQuotes.set(q.symbol, { ...q, source: 'polling' });
            });
            setQuotes(newQuotes);
        }
    }, [polledData]);

    // WebSocket connection management
    const connectWebSocket = useCallback(() => {
        if (!enabled || symbols.length === 0) return;

        // Check if WebSocket endpoint is available
        const wsEndpoint = process.env.NEXT_PUBLIC_WS_QUOTES_URL;
        if (!wsEndpoint) {
            if (fallbackToPolling) {
                setConnectionStatus('polling');
            }
            return;
        }

        setConnectionStatus('connecting');

        try {
            const ws = new WebSocket(wsEndpoint);
            wsRef.current = ws;

            ws.onopen = () => {
                setConnectionStatus('connected');
                // Subscribe to symbols
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    symbols: symbols,
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'quote') {
                        setQuotes(prev => {
                            const newQuotes = new Map(prev);
                            newQuotes.set(data.symbol, {
                                ...data,
                                source: 'websocket',
                                timestamp: Date.now(),
                            });
                            return newQuotes;
                        });
                    }
                } catch (err) {
                    console.error('Failed to parse WebSocket message:', err);
                }
            };

            ws.onerror = () => {
                console.warn('WebSocket error, falling back to polling');
                if (fallbackToPolling) {
                    setConnectionStatus('polling');
                }
            };

            ws.onclose = () => {
                setConnectionStatus('disconnected');
                // Auto-reconnect after 5 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (enabled) {
                        connectWebSocket();
                    }
                }, 5000);
            };
        } catch (err) {
            console.error('Failed to create WebSocket:', err);
            if (fallbackToPolling) {
                setConnectionStatus('polling');
            }
        }
    }, [enabled, symbols, fallbackToPolling]);

    // Initial connection
    useEffect(() => {
        if (enabled && symbols.length > 0) {
            connectWebSocket();
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [enabled, symbols.length, connectWebSocket]);

    // Get quote for a specific symbol
    const getQuote = useCallback((symbol: string): RealTimeQuote | undefined => {
        return quotes.get(symbol);
    }, [quotes]);

    // Manual refresh
    const refresh = useCallback(() => {
        if (connectionStatus === 'polling') {
            mutate();
        } else if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'refresh',
                symbols: symbols,
            }));
        }
    }, [connectionStatus, mutate, symbols]);

    return {
        quotes: Array.from(quotes.values()),
        quotesMap: quotes,
        getQuote,
        connectionStatus,
        isConnected: connectionStatus === 'connected' || connectionStatus === 'polling',
        isLoading: connectionStatus === 'connecting',
        refresh,
    };
}

/**
 * Hook for a single symbol's real-time quote
 */
export function useRealTimeQuote(symbol: string, options?: UseRealTimeQuotesOptions) {
    const { getQuote, ...rest } = useRealTimeQuotes([symbol], options);
    return {
        quote: getQuote(symbol),
        ...rest,
    };
}
