'use client';

import { useCallback, useRef, useState } from 'react';

// ── SSE Event Types ────────────────────────────────────────
export interface StreamNodeEvent {
    node: string;
    display: string;
}

export interface StreamCompleteEvent {
    session_id: string;
    status: string;
    market_insight?: Record<string, unknown>;
    investment_plan?: Record<string, unknown>;
    risk_assessment?: Record<string, unknown>;
}

export interface StreamErrorEvent {
    detail: string;
}

export type StreamPhase = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

export interface InvestmentStreamState {
    /** Current streaming phase */
    phase: StreamPhase;
    /** Ordered list of completed analysis nodes */
    completedNodes: string[];
    /** Currently active node (display label) */
    activeNode: string | null;
    /** Final analysis result (available after graph_complete) */
    result: StreamCompleteEvent | null;
    /** Error message if any */
    error: string | null;
    /** Progress percentage (0-100) based on known node count */
    progress: number;
}

/** Known LangGraph analysis nodes for progress estimation */
const EXPECTED_NODES = [
    'market_analyst',
    'fundamentals_researcher',
    'risk_evaluator',
    'strategy_planner',
    'portfolio_manager',
];

function estimateProgress(completedCount: number): number {
    return Math.min(100, Math.round((completedCount / EXPECTED_NODES.length) * 90));
}

/**
 * useInvestmentStream — F-06 Real-time Investment Analysis Hook
 *
 * Connects to the Next.js SSE proxy route (/api/market/portfolio/stream)
 * and provides reactive state for the LangGraph analysis pipeline.
 *
 * Usage:
 * ```tsx
 * const { state, startStream, cancelStream } = useInvestmentStream();
 *
 * <Button onClick={() => startStream('AAPL')}>Analyze</Button>
 * <ProgressBar value={state.progress} />
 * <span>{state.activeNode}</span>
 * ```
 */
export function useInvestmentStream() {
    const [state, setState] = useState<InvestmentStreamState>({
        phase: 'idle',
        completedNodes: [],
        activeNode: null,
        result: null,
        error: null,
        progress: 0,
    });

    const abortRef = useRef<AbortController | null>(null);

    const cancelStream = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setState(prev => ({
            ...prev,
            phase: prev.phase === 'complete' ? 'complete' : 'idle',
        }));
    }, []);

    const startStream = useCallback(async (
        symbol: string,
        options?: { risk_level?: string; action?: string },
    ) => {
        // Cancel any existing stream
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setState({
            phase: 'connecting',
            completedNodes: [],
            activeNode: null,
            result: null,
            error: null,
            progress: 0,
        });

        try {
            const res = await fetch('/api/market/portfolio/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    risk_level: options?.risk_level ?? 'moderate',
                    action: options?.action ?? 'full_analysis',
                }),
                signal: controller.signal,
            });

            if (!res.ok || !res.body) {
                const errText = await res.text().catch(() => 'Stream unavailable');
                setState(prev => ({ ...prev, phase: 'error', error: errText }));
                return;
            }

            setState(prev => ({ ...prev, phase: 'streaming' }));

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                let currentEvent = '';
                let currentData = '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        currentData = line.slice(6);
                    } else if (line === '' && currentEvent && currentData) {
                        try {
                            const parsed = JSON.parse(currentData);

                            switch (currentEvent) {
                                case 'node_start':
                                    setState(prev => ({
                                        ...prev,
                                        activeNode: parsed.display ?? parsed.node,
                                    }));
                                    break;

                                case 'node_complete':
                                    setState(prev => {
                                        const completed = [...prev.completedNodes, parsed.node ?? parsed.display];
                                        return {
                                            ...prev,
                                            completedNodes: completed,
                                            activeNode: null,
                                            progress: estimateProgress(completed.length),
                                        };
                                    });
                                    break;

                                case 'graph_complete':
                                    setState(prev => ({
                                        ...prev,
                                        phase: 'complete',
                                        activeNode: null,
                                        progress: 100,
                                        result: parsed,
                                    }));
                                    break;

                                case 'error':
                                    setState(prev => ({
                                        ...prev,
                                        phase: 'error',
                                        error: parsed.detail ?? 'Unknown error',
                                    }));
                                    break;
                            }
                        } catch {
                            // Non-JSON data, skip
                        }

                        currentEvent = '';
                        currentData = '';
                    }
                }
            }

            // If stream ended without graph_complete, mark as complete
            setState(prev => {
                if (prev.phase === 'streaming') {
                    return { ...prev, phase: 'complete', progress: 100 };
                }
                return prev;
            });

        } catch (err) {
            if ((err as Error).name === 'AbortError') return;  // Intentional cancel
            setState(prev => ({
                ...prev,
                phase: 'error',
                error: err instanceof Error ? err.message : 'Stream connection failed',
            }));
        }
    }, []);

    return { state, startStream, cancelStream };
}
