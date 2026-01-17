'use client';

import { useState, useCallback } from 'react';
import {
    analyzeStock,
    analyzeNewsImpact,
    getPortfolioAdvice,
    getMarketOutlook,
    askInvestmentQuestion,
    type StockAnalysis,
    type NewsImpactAnalysis,
    type PortfolioAdvice,
    type MarketOutlook,
} from '@/lib/ai/investment-analyzer';
import type { MarketQuote, FusedEvent } from '@/lib/api/types';
import type { Portfolio } from '@/lib/types/portfolio';
import type { TechnicalIndicators } from '@/lib/indicators/technical';

interface UseAIAnalysisState<T> {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
}

/**
 * Hook for AI stock analysis
 */
export function useStockAnalysis() {
    const [state, setState] = useState<UseAIAnalysisState<StockAnalysis>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const analyze = useCallback(async (
        quote: MarketQuote,
        indicators: TechnicalIndicators,
        recentNews: FusedEvent[]
    ) => {
        setState({ data: null, isLoading: true, error: null });
        try {
            const result = await analyzeStock(quote, indicators, recentNews);
            setState({ data: result, isLoading: false, error: null });
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Analysis failed');
            setState({ data: null, isLoading: false, error });
            throw error;
        }
    }, []);

    return { ...state, analyze };
}

/**
 * Hook for AI news impact analysis
 */
export function useNewsImpactAnalysis() {
    const [state, setState] = useState<UseAIAnalysisState<NewsImpactAnalysis>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const analyze = useCallback(async (
        event: FusedEvent,
        relatedQuotes: MarketQuote[]
    ) => {
        setState({ data: null, isLoading: true, error: null });
        try {
            const result = await analyzeNewsImpact(event, relatedQuotes);
            setState({ data: result, isLoading: false, error: null });
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Analysis failed');
            setState({ data: null, isLoading: false, error });
            throw error;
        }
    }, []);

    return { ...state, analyze };
}

/**
 * Hook for AI portfolio advice
 */
export function usePortfolioAdvice() {
    const [state, setState] = useState<UseAIAnalysisState<PortfolioAdvice>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const getAdvice = useCallback(async (portfolio: Portfolio) => {
        setState({ data: null, isLoading: true, error: null });
        try {
            const result = await getPortfolioAdvice(portfolio);
            setState({ data: result, isLoading: false, error: null });
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Analysis failed');
            setState({ data: null, isLoading: false, error });
            throw error;
        }
    }, []);

    return { ...state, getAdvice };
}

/**
 * Hook for AI market outlook
 */
export function useMarketOutlook() {
    const [state, setState] = useState<UseAIAnalysisState<MarketOutlook>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const getOutlook = useCallback(async (
        recentEvents: FusedEvent[],
        majorQuotes: MarketQuote[]
    ) => {
        setState({ data: null, isLoading: true, error: null });
        try {
            const result = await getMarketOutlook(recentEvents, majorQuotes);
            setState({ data: result, isLoading: false, error: null });
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Analysis failed');
            setState({ data: null, isLoading: false, error });
            throw error;
        }
    }, []);

    return { ...state, getOutlook };
}

/**
 * Hook for AI chat/Q&A
 */
export function useAIChat() {
    const [messages, setMessages] = useState<Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
    }>>([]);
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = useCallback(async (
        question: string,
        context?: {
            portfolio?: Portfolio;
            watchlist?: MarketQuote[];
            recentNews?: FusedEvent[];
        }
    ) => {
        // Add user message
        setMessages(prev => [...prev, {
            role: 'user',
            content: question,
            timestamp: new Date(),
        }]);

        setIsLoading(true);
        try {
            const response = await askInvestmentQuestion(question, context);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            }]);
            return response;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '分析失敗';
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `抱歉，發生錯誤: ${errorMessage}`,
                timestamp: new Date(),
            }]);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    return {
        messages,
        isLoading,
        sendMessage,
        clearMessages,
    };
}
